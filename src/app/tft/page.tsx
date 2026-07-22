"use client";

import { useEffect, useMemo, useState } from "react";
import type { Player } from "@/lib/kv";
import TftPlayerRow, { type TftStats } from "@/components/TftPlayerRow";
import TftPlayerCardMobile from "@/components/TftPlayerCardMobile";
import { computeLpGaps, eloScore, totalLp } from "@/lib/rank";

type RankedEntry = NonNullable<NonNullable<TftStats>["ranked"]>;

function winrateScore(ranked: RankedEntry | null) {
  if (!ranked) return -1;
  const total = ranked.wins + ranked.losses;
  return total > 0 ? ranked.wins / total : -1;
}

function avgPlacement(stats: TftStats) {
  if (!stats?.matches || stats.matches.length === 0) return null;
  const sum = stats.matches.reduce((acc, m) => acc + m.placement, 0);
  return sum / stats.matches.length;
}

type SortKey = "winrate" | "elo" | "avgPlacement";
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
  const [sortKey, setSortKey] = useState<SortKey>("elo");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [filter, setFilter] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem("tft-sort");
    if (!saved) return;
    try {
      const parsed = JSON.parse(saved) as { key?: SortKey; dir?: SortDir };
      if (parsed.key) setSortKey(parsed.key);
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
          const list: Player[] = data.players ?? [];
          setPlayers(list);

          const results = await Promise.all(
            list.map((p) =>
              fetch(`/api/tft/stats?puuid=${p.puuid}&region=${p.region}`)
                .then((res) => res.json())
                .then((d) => ({
                  id: p.id,
                  stats: d.error ? null : (d as TftStats),
                  error: (d.error as string | undefined) ?? null,
                }))
                .catch(() => ({ id: p.id, stats: null, error: "No se pudo cargar" }))
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
    const interval = setInterval(loadAll, 30 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

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
      const rankedA = statsMap[a.id]?.ranked ?? null;
      const rankedB = statsMap[b.id]?.ranked ?? null;

      if (sortKey === "winrate")
        return dirFactor * (winrateScore(rankedA) - winrateScore(rankedB));
      if (sortKey === "elo") return dirFactor * (eloScore(rankedA) - eloScore(rankedB));

      const avgA = avgPlacement(statsMap[a.id] ?? null);
      const avgB = avgPlacement(statsMap[b.id] ?? null);
      // Lower average placement is better, so invert vs. the usual "higher is better" scoring.
      const scoreA = avgA === null ? -100 : -avgA;
      const scoreB = avgB === null ? -100 : -avgB;
      return dirFactor * (scoreA - scoreB);
    });
  }, [players, statsMap, sortKey, sortDir, filter]);

  const lpGapById = useMemo(() => {
    const eloSorted = players
      .slice()
      .sort((a, b) => eloScore(statsMap[b.id]?.ranked ?? null) - eloScore(statsMap[a.id]?.ranked ?? null));
    const gaps = computeLpGaps(eloSorted.map((p) => totalLp(statsMap[p.id]?.ranked ?? null)));

    const map: Record<string, { toNext: number | null; toPrevious: number | null }> = {};
    eloSorted.forEach((p, i) => {
      map[p.id] = gaps[i];
    });
    return map;
  }, [players, statsMap]);

  return (
    <main className="min-h-screen bg-gradient-to-b from-[#0a0e1a] to-[#111827] px-4 py-12">
      <div className="max-w-4xl mx-auto">
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
            <option value="winrate" className="bg-[#111827]">
              Ordenar por winrate
            </option>
            <option value="elo" className="bg-[#111827]">
              Ordenar por elo
            </option>
            <option value="avgPlacement" className="bg-[#111827]">
              Ordenar por posición prom.
            </option>
          </select>
        </div>

        {loading && <p className="text-white/40">Cargando jugadores...</p>}

        {!loading && players.length === 0 && (
          <p className="text-white/40">
            Todavía no hay jugadores cargados. Andá a /tft/admin para agregar.
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
                      label="Winrate"
                      active={sortKey === "winrate"}
                      dir={sortDir}
                      onClick={() => handleSort("winrate")}
                    />
                    <SortHeader
                      label="Pos. prom."
                      active={sortKey === "avgPlacement"}
                      dir={sortDir}
                      onClick={() => handleSort("avgPlacement")}
                    />
                    <th className="px-4 py-3 text-left text-white/60 font-medium">
                      LP hasta
                    </th>
                    <th className="px-4 py-3 text-left text-white/60 font-medium">
                      DPM
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
                />
              ))}
            </div>
          </>
        )}
      </div>
    </main>
  );
}
