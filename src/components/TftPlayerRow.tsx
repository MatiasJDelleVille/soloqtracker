"use client";

import type { Player } from "@/lib/kv";
import { formatPercent, metaTftProfileUrl, type TftStats } from "@/lib/tft";
import LpGapBox, { type LpGap } from "./LpGapBox";
import TftMatchList from "./TftMatchList";

export type { TftStats } from "@/lib/tft";

function MetaTftBadge({ player }: { player: Player }) {
  return (
    <a
      href={metaTftProfileUrl(player)}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      title="Ver en MetaTFT"
      className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 transition shrink-0 p-1.5"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/metatft.png" alt="MetaTFT" className="w-full h-full object-contain" />
    </a>
  );
}

export default function TftPlayerRow({
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
  stats: TftStats;
  error: string | null;
  loading: boolean;
  lpGap: LpGap;
  expanded: boolean;
  onToggle: () => void;
}) {
  const ranked = stats?.ranked ?? null;
  const summary = stats?.summary;

  return (
    <>
      <tr
        onClick={onToggle}
        className="cursor-pointer border-b border-white/10 hover:bg-white/5 transition"
      >
        <td className="px-4 py-3 text-white/40 font-mono">{rank}</td>
        <td className="px-4 py-3">
          <div className="flex items-center gap-3">
            {stats?.profileIconId != null && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={`https://ddragon.leagueoflegends.com/cdn/${stats.ddragonVersion}/img/profileicon/${stats.profileIconId}.png`}
                alt=""
                className="w-9 h-9 rounded-full border border-white/10 shrink-0"
              />
            )}
            <div>
              <p className="text-white font-semibold whitespace-nowrap">
                {player.game_name}
                <span className="text-white/40">#{player.tag_line}</span>
              </p>
              {loading && <p className="text-sm text-white/40">Cargando...</p>}
              {error && <p className="text-sm text-red-400">{error}</p>}
            </div>
          </div>
        </td>
        <td className="px-4 py-3 text-white/70 whitespace-nowrap">
          {ranked
            ? `${ranked.tier} ${ranked.rank} (${ranked.leaguePoints} LP)`
            : stats
              ? "Sin ranked"
              : ""}
        </td>
        <td className="px-4 py-3 whitespace-nowrap">
          {summary?.avgPlacement != null && (
            <>
              <span className="text-white font-bold">{summary.avgPlacement.toFixed(2)}</span>
              <span className="ml-1.5 text-xs text-white/40">{summary.games} partidas</span>
            </>
          )}
        </td>
        <td className="px-4 py-3 whitespace-nowrap">
          {summary?.top4Rate != null && ranked && (
            <>
              <span className="text-white font-bold">{formatPercent(summary.top4Rate)}</span>
              <span className="ml-1.5 text-xs text-white/40">
                {ranked.wins}/{ranked.wins + ranked.losses}
              </span>
            </>
          )}
        </td>
        <td className="px-4 py-3 whitespace-nowrap">
          {summary?.winRate != null && (
            <span className="text-white font-bold">{formatPercent(summary.winRate)}</span>
          )}
        </td>
        <td className="px-4 py-3">
          <LpGapBox {...lpGap} />
        </td>
        <td className="px-4 py-3 text-center">
          <MetaTftBadge player={player} />
        </td>
      </tr>

      {expanded && stats && (
        <tr className="border-b border-white/10">
          <td colSpan={8} className="p-3 bg-[#17181c]">
            <div className="overflow-x-auto">
              <TftMatchList matches={stats.matches} trackedPuuid={player.puuid} />
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
