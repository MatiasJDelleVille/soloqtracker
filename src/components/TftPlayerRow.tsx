"use client";

import type { Player } from "@/lib/kv";

type RankedEntry = {
  tier: string;
  rank: string;
  leaguePoints: number;
  wins: number;
  losses: number;
} | null;

type MatchSummary = {
  matchId: string;
  placement: number;
  level: number;
  gameLengthSeconds: number;
};

export type TftStats = {
  ranked: RankedEntry;
  matches: MatchSummary[];
} | null;

function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function placementColor(placement: number) {
  if (placement <= 4) return "text-emerald-400";
  return "text-red-400";
}

function DpmBadge({ player }: { player: Player }) {
  const dpmUrl = `https://dpm.lol/${encodeURIComponent(player.game_name)}-${encodeURIComponent(
    player.tag_line
  )}?queue=ranked`;

  return (
    <a
      href={dpmUrl}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      title="Ver en DPM.lol"
      className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 transition shrink-0 p-1.5"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="https://dpm.lol/logo.png" alt="DPM.lol" className="w-full h-full object-contain" />
    </a>
  );
}

export default function TftPlayerRow({
  rank,
  player,
  stats,
  error,
  loading,
  expanded,
  onToggle,
}: {
  rank: number;
  player: Player;
  stats: TftStats;
  error: string | null;
  loading: boolean;
  expanded: boolean;
  onToggle: () => void;
}) {
  const total = stats?.ranked ? stats.ranked.wins + stats.ranked.losses : 0;
  const winrate = total > 0 ? Math.round((stats!.ranked!.wins / total) * 100) : null;
  const avgPlacement =
    stats?.matches && stats.matches.length > 0
      ? (
          stats.matches.reduce((acc, m) => acc + m.placement, 0) / stats.matches.length
        ).toFixed(1)
      : null;

  return (
    <>
      <tr
        onClick={onToggle}
        className="cursor-pointer border-b border-white/10 hover:bg-white/5 transition"
      >
        <td className="px-4 py-3 text-white/40 font-mono">{rank}</td>
        <td className="px-4 py-3">
          <p className="text-white font-semibold">
            {player.game_name}
            <span className="text-white/40">#{player.tag_line}</span>
          </p>
          {loading && <p className="text-sm text-white/40">Cargando...</p>}
          {error && <p className="text-sm text-red-400">{error}</p>}
        </td>
        <td className="px-4 py-3 text-white/70">
          {stats?.ranked
            ? `${stats.ranked.tier} ${stats.ranked.rank} (${stats.ranked.leaguePoints} LP)`
            : stats
              ? "Sin ranked"
              : ""}
        </td>
        <td className="px-4 py-3">
          {stats?.ranked && (
            <span className="whitespace-nowrap">
              <span className="text-white font-bold">{winrate}%</span>{" "}
              <span className="text-white/40">·</span>{" "}
              <span className="text-emerald-400">W: {stats.ranked.wins}</span>{" "}
              <span className="text-red-400">L: {stats.ranked.losses}</span>
            </span>
          )}
        </td>
        <td className="px-4 py-3 text-white/70">{avgPlacement ?? ""}</td>
        <td className="px-4 py-3">
          <DpmBadge player={player} />
        </td>
      </tr>

      {expanded && stats?.matches && (
        <tr className="border-b border-white/10 bg-white/[0.02]">
          <td colSpan={6} className="px-4 py-4">
            {stats.matches.length === 0 && (
              <p className="text-white/40">Sin partidas recientes</p>
            )}
            <div className="flex flex-col gap-2">
              {stats.matches.map((m) => (
                <div
                  key={m.matchId}
                  className="flex items-center justify-between rounded-lg bg-white/5 px-4 py-2"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`font-bold text-lg w-8 ${placementColor(m.placement)}`}
                    >
                      #{m.placement}
                    </span>
                    <div>
                      <p className="text-white font-medium">Nivel {m.level}</p>
                      <p className="text-sm text-white/40">
                        {formatDuration(m.gameLengthSeconds)}
                      </p>
                    </div>
                  </div>
                  <p
                    className={`text-sm font-medium ${placementColor(m.placement)}`}
                  >
                    {m.placement <= 4 ? "Top 4" : "Bottom 4"}
                  </p>
                </div>
              ))}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
