"use client";

import type { Player } from "@/lib/kv";
import type { Stats } from "./PlayerRow";
import LpGapBox, { type LpGap } from "./LpGapBox";
import MatchScoreboard from "./MatchScoreboard";

function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function PlayerCardMobile({
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

  const dpmUrl = `https://dpm.lol/${encodeURIComponent(player.game_name)}-${encodeURIComponent(
    player.tag_line
  )}?queue=solo`;

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 overflow-hidden">
      <div onClick={onToggle} className="flex items-center gap-3 p-4 cursor-pointer">
        <span className="text-white/40 font-mono w-5 shrink-0">{rank}</span>

        {stats?.profileIconId ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`https://ddragon.leagueoflegends.com/cdn/${stats.ddragonVersion}/img/profileicon/${stats.profileIconId}.png`}
            alt=""
            className="w-10 h-10 rounded-full border border-white/10 shrink-0"
          />
        ) : (
          <div className="w-10 h-10 rounded-full bg-white/10 shrink-0" />
        )}

        <div className="flex-1 min-w-0">
          <p className="text-white font-semibold truncate">
            {player.game_name}
            <span className="text-white/40">#{player.tag_line}</span>
          </p>
          {loading && <p className="text-sm text-white/40">Cargando...</p>}
          {error && <p className="text-sm text-red-400">{error}</p>}
          {stats?.ranked ? (
            <p className="text-sm text-white/60">
              {stats.ranked.tier} {stats.ranked.rank} ({stats.ranked.leaguePoints} LP)
              {stats.lpChange !== null && (
                <span
                  className={`ml-1.5 font-medium ${
                    stats.lpChange >= 0 ? "text-emerald-400" : "text-red-400"
                  }`}
                >
                  ({stats.lpChange >= 0 ? "+" : ""}
                  {stats.lpChange})
                </span>
              )}
            </p>
          ) : (
            stats && <p className="text-sm text-white/40">Sin ranked</p>
          )}
        </div>

        <LpGapBox {...lpGap} />

        <a
          href={dpmUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          title="Ver en DPM.lol"
          className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 transition shrink-0 p-1.5"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="https://dpm.lol/logo.png"
            alt="DPM.lol"
            className="w-full h-full object-contain"
          />
        </a>
      </div>

      {stats?.ranked && (
        <div className="flex items-center gap-4 px-4 pb-4 -mt-1">
          <span className="text-white font-bold text-lg">{winrate}%</span>
          <span className="text-emerald-400">W: {stats.ranked.wins}</span>
          <span className="text-red-400">L: {stats.ranked.losses}</span>
        </div>
      )}

      {expanded && stats?.matches && (
        <div className="border-t border-white/10 p-3 flex flex-col gap-3">
          {stats.matches.length === 0 && (
            <p className="text-white/40 px-1">Sin partidas recientes</p>
          )}
          {stats.matches.map((m) => (
            <div key={m.matchId} className="rounded-lg bg-white/5 p-3">
              <p className="text-xs text-white/40 mb-2">
                {m.championName} · {formatDuration(m.durationSeconds)}
              </p>
              <MatchScoreboard participants={m.participants} trackedPuuid={player.puuid} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
