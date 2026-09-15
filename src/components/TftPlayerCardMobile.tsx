"use client";

import type { Player } from "@/lib/kv";
import { formatPercent, metaTftProfileUrl, type TftStats } from "@/lib/tft";
import LpGapBox, { type LpGap } from "./LpGapBox";
import TftMatchList from "./TftMatchList";

export default function TftPlayerCardMobile({
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
  const hasSummary =
    summary && (summary.top4Rate !== null || summary.winRate !== null || summary.avgPlacement !== null);

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
          {ranked ? (
            <p className="text-sm text-white/60">
              {ranked.tier} {ranked.rank} ({ranked.leaguePoints} LP)
            </p>
          ) : (
            stats && <p className="text-sm text-white/40">Sin ranked</p>
          )}
        </div>

        <LpGapBox {...lpGap} />

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
      </div>

      {hasSummary && (
        <div className="flex items-center gap-4 px-4 pb-4 -mt-1 flex-wrap text-sm text-white/60">
          {summary.avgPlacement !== null && (
            <span>
              AVG Placement{" "}
              <span className="text-white font-bold">{summary.avgPlacement.toFixed(2)}</span>
            </span>
          )}
          {summary.top4Rate !== null && (
            <span>
              Top 4 <span className="text-white font-bold">{formatPercent(summary.top4Rate)}</span>
            </span>
          )}
          {summary.winRate !== null && (
            <span>
              Win <span className="text-white font-bold">{formatPercent(summary.winRate)}</span>
            </span>
          )}
        </div>
      )}

      {expanded && stats && (
        <div className="border-t border-white/10 p-2 bg-[#17181c] overflow-x-auto">
          <TftMatchList matches={stats.matches} trackedPuuid={player.puuid} />
        </div>
      )}
    </div>
  );
}
