"use client";

import { useEffect, useMemo, useState } from "react";
import type { Player } from "@/lib/kv";
import PlayerRow, { type Stats } from "@/components/PlayerRow";
import PlayerCardMobile from "@/components/PlayerCardMobile";

const TIER_ORDER = [
  "IRON",
  "BRONZE",
  "SILVER",
  "GOLD",
  "PLATINUM",
  "EMERALD",
  "DIAMOND",
  "MASTER",
  "GRANDMASTER",
  "CHALLENGER",
];
const RANK_ORDER: Record<string, number> = { IV: 0, III: 1, II: 2, I: 3 };

type RankedEntry = NonNullable<NonNullable<Stats>["ranked"]>;

function eloScore(ranked: RankedEntry | null) {
  if (!ranked) return -1;
  const tierIndex = TIER_ORDER.indexOf(ranked.tier);
  const rankScore = RANK_ORDER[ranked.rank] ?? 0;
  return tierIndex * 1000 + rankScore * 200 + ranked.leaguePoints;
}

function winrateScore(ranked: RankedEntry | null) {
  if (!ranked) return -1;
  const total = ranked.wins + ranked.losses;
  return total > 0 ? ranked.wins / total : -1;
}

type SortKey = "winrate" | "elo";
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

export default function Home() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [statsMap, setStatsMap] = useState<Record<string, Stats>>({});
  const [errorMap, setErrorMap] = useState<Record<string, string | null>>({});
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>("elo");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [filter, setFilter] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem("soloq-sort");
    if (!saved) return;
    try {
      const parsed = JSON.parse(saved) as { key?: SortKey; dir?: SortDir };
      if (parsed.key) setSortKey(parsed.key);
      if (parsed.dir) setSortDir(parsed.dir);
    } catch {}
  }, []);

  useEffect(() => {
    localStorage.setItem("soloq-sort", JSON.stringify({ key: sortKey, dir: sortDir }));
  }, [sortKey, sortDir]);

  useEffect(() => {
    fetch("/api/players")
      .then((res) => res.json())
      .then(async (data) => {
        const list: Player[] = data.players ?? [];
        setPlayers(list);

        const results = await Promise.all(
          list.map((p) =>
            fetch(`/api/stats?puuid=${p.puuid}&region=${p.region}`)
              .then((res) => res.json())
              .then((d) => ({
                id: p.id,
                stats: d.error ? null : (d as Stats),
                error: (d.error as string | undefined) ?? null,
              }))
              .catch(() => ({ id: p.id, stats: null, error: "No se pudo cargar" }))
          )
        );

        const nextStats: Record<string, Stats> = {};
        const nextErrors: Record<string, string | null> = {};
        for (const r of results) {
          nextStats[r.id] = r.stats;
          nextErrors[r.id] = r.error;
        }
        setStatsMap(nextStats);
        setErrorMap(nextErrors);
      })
      .finally(() => setLoading(false));
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
      return dirFactor * (eloScore(rankedA) - eloScore(rankedB));
    });
  }, [players, statsMap, sortKey, sortDir, filter]);

  return (
    <main className="min-h-screen bg-gradient-to-b from-[#0a0e1a] to-[#111827] px-4 py-12">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-1">
          <h1 className="text-3xl font-bold text-white">SoloQ Tracker</h1>
          <a href="/tft" className="text-sm text-white/40 hover:text-white transition">
            Ver TFT →
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
          </select>
        </div>

        {loading && <p className="text-white/40">Cargando jugadores...</p>}

        {!loading && players.length === 0 && (
          <p className="text-white/40">
            Todavía no hay jugadores cargados. Andá a /admin para agregar.
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
                    <th className="px-4 py-3 text-left text-white/60 font-medium">
                      DPM
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((p, i) => (
                    <PlayerRow
                      key={p.id}
                      rank={i + 1}
                      player={p}
                      stats={statsMap[p.id] ?? null}
                      error={errorMap[p.id] ?? null}
                      loading={loading}
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
                <PlayerCardMobile
                  key={p.id}
                  rank={i + 1}
                  player={p}
                  stats={statsMap[p.id] ?? null}
                  error={errorMap[p.id] ?? null}
                  loading={loading}
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
