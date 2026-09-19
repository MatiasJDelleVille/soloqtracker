"use client";

import { useEffect, useMemo, useState } from "react";
import type { Player } from "@/lib/kv";
import TftPlayerRow, { type TftStats } from "@/components/TftPlayerRow";
import TftPlayerCardMobile from "@/components/TftPlayerCardMobile";
import { computeLpGaps, eloScore } from "@/lib/rank";

type SortKey = "elo" | "top4" | "win" | "avgPlacement";

const SORT_KEYS: SortKey[] = ["elo", "top4", "win", "avgPlacement"];

function sortScore(key: SortKey, stats: TftStats): number {
  if (key === "elo") return eloScore(stats?.ranked ?? null);
  const summary = stats?.summary;
  if (key === "top4") return summary?.top4Rate ?? -1;
  if (key === "win") return summary?.winRate ?? -1;
  // Lower average placement is better, so it's negated to sort like the other "higher is better" scores.
  return summary?.avgPlacement != null ? -summary.avgPlacement : -100;
}
type SortDir = "asc" | "desc";

function SortHeader({
  label,
  active,
  dir,
  onClick,
}: {
  label: string;
  active: boolean;
  dir: SortDir;
  onClick: () => void;
}) {
  return (
    <th
      onClick={onClick}
      className="px-4 py-3 text-left text-white/60 font-medium cursor-pointer select-none hover:text-white transition whitespace-nowrap"
    >
      {label}{" "}
      <span className={active ? "text-white" : "text-white/20"}>
        {active ? (dir === "desc" ? "▼" : "▲") : "▲"}
      </span>
    </th>
  );
}

export default function TftHome() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [statsMap, setStatsMap] = useState<Record<string, TftStats>>({});
  const [errorMap, setErrorMap] = useState<Record<string, string | null>>({});
  const [loading, setLoading] = useState(true);
  // Separate from an empty roster: the players list request itself failed
  // (e.g. Redis is over its request quota). Showing "no players yet" in that
  // case would be misleading, so it's tracked and hidden separately.
  const [playersLoadError, setPlayersLoadError] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("elo");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [filter, setFilter] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem("tft-sort");
    if (!saved) return;
    try {
      const parsed = JSON.parse(saved) as { key?: SortKey; dir?: SortDir };
      if (parsed.key && SORT_KEYS.includes(parsed.key)) setSortKey(parsed.key);
      if (parsed.dir) setSortDir(parsed.dir);
    } catch {}
  }, []);

  useEffect(() => {
    localStorage.setItem("tft-sort", JSON.stringify({ key: sortKey, dir: sortDir }));
  }, [sortKey, sortDir]);

  useEffect(() => {
    const loadAll = () =>
      fetch("/api/tft/players")
        .then((res) => res.json())
        .then(async (data) => {
          if (data.error) {
            setPlayersLoadError(true);
            return;
          }
          setPlayersLoadError(false);
          const list: Player[] = data.players ?? [];
          setPlayers(list);

          const results = await Promise.all(
            list.map((p, i) =>
              new Promise((resolve) => setTimeout(resolve, i * 300)).then(() =>
                fetch(`/api/tft/stats?puuid=${p.puuid}&region=${p.region}`)
                  .then((res) => res.json())
                  .then((d) => ({
                    id: p.id,
                    stats: d.error ? null : (d as TftStats),
                    error: (d.error as string | undefined) ?? null,
                  }))
                  .catch(() => ({ id: p.id, stats: null, error: "No se pudo cargar" }))
              )
            )
          );

          const nextStats: Record<string, TftStats> = {};
          const nextErrors: Record<string, string | null> = {};
          for (const r of results) {
            nextStats[r.id] = r.stats;
            nextErrors[r.id] = r.error;
          }
          setStatsMap(nextStats);
          setErrorMap(nextErrors);
        })
        .finally(() => setLoading(false));

    loadAll();
    // Every open tab counts against Redis's monthly command quota (shared
    // across everyone tracking this group), so the interval has to stay
    // conservative — this matches the original cadence, now much cheaper
    // per call after batching the match-detail lookups into one command.
    const POLL_MS = 20 * 60 * 1000;
    let lastLoad = Date.now();
    const interval = setInterval(() => {
      if (document.hidden) return;
      lastLoad = Date.now();
      loadAll();
    }, POLL_MS);

    // A backgrounded tab skips the interval above entirely, so refresh
    // immediately when the user comes back to it instead of leaving them
    // looking at data that's been stale since before they tabbed away.
    const onVisible = () => {
      if (!document.hidden && Date.now() - lastLoad > POLL_MS) {
        lastLoad = Date.now();
        loadAll();
      }
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  // While a player's match index is still warming up (Riot rate limits cap how
  // many matches get indexed per request) their summary is partial, so re-ask
  // just those players shortly after until it's complete.
  const hasPartial = Object.values(statsMap).some((s) => s?.incomplete);
  useEffect(() => {
    if (!hasPartial) return;
    const timer = setTimeout(() => {
      if (document.hidden) return;
      players.forEach((p, i) => {
        if (!statsMap[p.id]?.incomplete) return;
        setTimeout(() => {
          fetch(`/api/tft/stats?puuid=${p.puuid}&region=${p.region}`)
            .then((res) => res.json())
            .then((d) => {
              if (d.error) return;
              const fresh = d as NonNullable<TftStats>;
              setStatsMap((prev) => {
                const prevStats = prev[p.id];
                // Keep any extra history pages the viewer already loaded.
                const keepMatches = prevStats && prevStats.matches.length > fresh.matches.length;
                return {
                  ...prev,
                  [p.id]: keepMatches
                    ? { ...fresh, matches: prevStats.matches, hasMore: prevStats.hasMore }
                    : fresh,
                };
              });
            })
            .catch(() => {});
        }, i * 600);
      });
    }, 65 * 1000);
    return () => clearTimeout(timer);
  }, [hasPartial, statsMap, players]);

  const loadMoreMatches = async (player: Player): Promise<number> => {
    const current = statsMap[player.id];
    if (!current) return 0;

    const res = await fetch(
      `/api/tft/stats?puuid=${player.puuid}&region=${player.region}&start=${current.matches.length}`
    );
    const data = await res.json();
    if (data.error) return 0;

    const newMatches = (data.matches ?? []) as NonNullable<TftStats>["matches"];
    setStatsMap((prev) => {
      const prevStats = prev[player.id];
      if (!prevStats) return prev;
      return {
        ...prev,
        [player.id]: {
          ...prevStats,
          matches: [...prevStats.matches, ...newMatches],
          hasMore: Boolean(data.hasMore),
        },
      };
    });
    return newMatches.length;
  };

  const handleSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  const sorted = useMemo(() => {
    const filtered = players.filter((p) =>
      `${p.game_name}#${p.tag_line}`.toLowerCase().includes(filter.toLowerCase())
    );

    const dirFactor = sortDir === "desc" ? -1 : 1;

    return filtered.slice().sort((a, b) => {
      return (
        dirFactor *
        (sortScore(sortKey, statsMap[a.id] ?? null) - sortScore(sortKey, statsMap[b.id] ?? null))
      );
    });
  }, [players, statsMap, sortKey, sortDir, filter]);

  const lpGapById = useMemo(() => {
    const eloSorted = players
      .slice()
      .sort((a, b) => eloScore(statsMap[b.id]?.ranked ?? null) - eloScore(statsMap[a.id]?.ranked ?? null));
    const gaps = computeLpGaps(eloSorted.map((p) => statsMap[p.id]?.ranked ?? null));

    const map: Record<string, { toNext: number | null; toPrevious: number | null }> = {};
    eloSorted.forEach((p, i) => {
      map[p.id] = gaps[i];
    });
    return map;
  }, [players, statsMap]);

  return (
    <main className="min-h-screen bg-gradient-to-b from-[#0a0e1a] to-[#111827] px-4 py-12">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-1">
          <h1 className="text-3xl font-bold text-white">TFT Tracker</h1>
          <a href="/" className="text-sm text-white/40 hover:text-white transition">
            ← Ver SoloQ
          </a>
        </div>
        <p className="text-white/40 mb-8">Progreso de kukamigos en el SoloQ Challenge</p>

        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Buscar jugador..."
            className="flex-1 rounded-lg bg-white/5 border border-white/10 px-4 py-2 text-white placeholder:text-white/30 outline-none focus:border-white/30"
          />
          <select
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value as SortKey)}
            className="md:hidden rounded-lg bg-white/5 border border-white/10 px-4 py-2 text-white outline-none focus:border-white/30"
          >
            <option value="elo" className="bg-[#111827]">
              Ordenar por elo
            </option>
            <option value="avgPlacement" className="bg-[#111827]">
              Ordenar por AVG Placement
            </option>
            <option value="top4" className="bg-[#111827]">
              Ordenar por Top 4
            </option>
            <option value="win" className="bg-[#111827]">
              Ordenar por Win
            </option>
          </select>
        </div>

        {loading && <p className="text-white/40">Cargando jugadores...</p>}

        {!loading && !playersLoadError && players.length === 0 && (
          <p className="text-white/40">
            Todavía no hay jugadores cargados.
          </p>
        )}

        {!loading && players.length > 0 && sorted.length === 0 && (
          <p className="text-white/40">Ningún jugador coincide con la búsqueda.</p>
        )}

        {sorted.length > 0 && (
          <>
            <div className="hidden md:block rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="px-4 py-3 text-left text-white/60 font-medium">
                      #
                    </th>
                    <th className="px-4 py-3 text-left text-white/60 font-medium">
                      Jugador
                    </th>
                    <SortHeader
                      label="Elo"
                      active={sortKey === "elo"}
                      dir={sortDir}
                      onClick={() => handleSort("elo")}
                    />
                    <SortHeader
                      label="AVG Placement"
                      active={sortKey === "avgPlacement"}
                      dir={sortDir}
                      onClick={() => handleSort("avgPlacement")}
                    />
                    <SortHeader
                      label="Top 4"
                      active={sortKey === "top4"}
                      dir={sortDir}
                      onClick={() => handleSort("top4")}
                    />
                    <SortHeader
                      label="Win"
                      active={sortKey === "win"}
                      dir={sortDir}
                      onClick={() => handleSort("win")}
                    />
                    <th className="px-4 py-3 text-left text-white/60 font-medium">
                      LP hasta
                    </th>
                    <th className="px-4 py-3 text-center text-white/60 font-medium">
                      MetaTFT
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((p, i) => (
                    <TftPlayerRow
                      key={p.id}
                      rank={i + 1}
                      player={p}
                      stats={statsMap[p.id] ?? null}
                      error={errorMap[p.id] ?? null}
                      loading={loading}
                      lpGap={lpGapById[p.id] ?? { toNext: null, toPrevious: null }}
                      expanded={expandedId === p.id}
                      onToggle={() =>
                        setExpandedId((id) => (id === p.id ? null : p.id))
                      }
                      onLoadMoreMatches={() => loadMoreMatches(p)}
                    />
                  ))}
                </tbody>
              </table>
            </div>

            <div className="md:hidden flex flex-col gap-3">
              {sorted.map((p, i) => (
                <TftPlayerCardMobile
                  key={p.id}
                  rank={i + 1}
                  player={p}
                  stats={statsMap[p.id] ?? null}
                  error={errorMap[p.id] ?? null}
                  loading={loading}
                  lpGap={lpGapById[p.id] ?? { toNext: null, toPrevious: null }}
                  expanded={expandedId === p.id}
                  onToggle={() => setExpandedId((id) => (id === p.id ? null : p.id))}
                  onLoadMoreMatches={() => loadMoreMatches(p)}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </main>
  );
}
