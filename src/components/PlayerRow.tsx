"use client";

import type { Player } from "@/lib/kv";
import LpGapBox, { type LpGap } from "./LpGapBox";
import MatchScoreboard, { type ScoreboardParticipant } from "./MatchScoreboard";

type RankedEntry = {
  tier: string;
  rank: string;
  leaguePoints: number;
  wins: number;
  losses: number;
} | null;

type MatchSummary = {
  matchId: string;
  win: boolean;
  championName: string;
  kills: number;
  deaths: number;
  assists: number;
  durationSeconds: number;
  gameEndTimestamp: number;
  participants: ScoreboardParticipant[];
};

export type Stats = {
  ranked: RankedEntry;
  matches: MatchSummary[];
  profileIconId: number;
  ddragonVersion: string;
  lpChange: number | null;
} | null;

function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function DpmBadge({ player }: { player: Player }) {
  const dpmUrl = `https://dpm.lol/${encodeURIComponent(player.game_name)}-${encodeURIComponent(
    player.tag_line
  )}?queue=solo`;

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

export default function PlayerRow({
  rank,
  player,
  stats,
  error,
  loading,
  lpGap,
  expanded,
  onToggle,
}: {
  rank: number;
  player: Player;
  stats: Stats;
  error: string | null;
  loading: boolean;
  lpGap: LpGap;
  expanded: boolean;
  onToggle: () => void;
}) {
  const total = stats?.ranked ? stats.ranked.wins + stats.ranked.losses : 0;
  const winrate = total > 0 ? Math.round((stats!.ranked!.wins / total) * 100) : null;

  return (
    <>
      <tr
        onClick={onToggle}
        className="cursor-pointer border-b border-white/10 hover:bg-white/5 transition"
      >
        <td className="px-4 py-3 text-white/40 font-mono">{rank}</td>
        <td className="px-4 py-3">
          <div className="flex items-center gap-3">
            {stats?.profileIconId && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={`https://ddragon.leagueoflegends.com/cdn/${stats.ddragonVersion}/img/profileicon/${stats.profileIconId}.png`}
                alt=""
                className="w-9 h-9 rounded-full border border-white/10 shrink-0"
              />
            )}
            <div>
              <p className="text-white font-semibold">
                {player.game_name}
                <span className="text-white/40">#{player.tag_line}</span>
              </p>
              {loading && <p className="text-sm text-white/40">Cargando...</p>}
              {error && <p className="text-sm text-red-400">{error}</p>}
            </div>
          </div>
        </td>
        <td className="px-4 py-3 text-white/70">
          {stats?.ranked ? (
            <>
              {stats.ranked.tier} {stats.ranked.rank} ({stats.ranked.leaguePoints} LP)
              {stats.lpChange !== null && (
                <span
                  className={`ml-1.5 text-xs font-medium ${
                    stats.lpChange >= 0 ? "text-emerald-400" : "text-red-400"
                  }`}
                >
                  ({stats.lpChange >= 0 ? "+" : ""}
                  {stats.lpChange})
                </span>
              )}
            </>
          ) : stats ? (
            "Sin ranked"
          ) : (
            ""
          )}
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
        <td className="px-4 py-3">
          <LpGapBox {...lpGap} />
        </td>
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
            <div className="flex flex-col gap-3">
              {stats.matches.map((m) => (
                <div key={m.matchId} className="rounded-lg bg-white/5 p-3">
                  <p className="text-xs text-white/40 mb-2">
                    {m.championName} · {formatDuration(m.durationSeconds)}
                  </p>
                  <MatchScoreboard participants={m.participants} trackedPuuid={player.puuid} />
                </div>
              ))}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
