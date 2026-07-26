"use client";

import { useState } from "react";
import MatchScoreboard, { type ScoreboardParticipant } from "./MatchScoreboard";

export type MatchSummary = {
  matchId: string;
  win: boolean;
  championName: string;
  kills: number;
  deaths: number;
  assists: number;
  durationSeconds: number;
  gameEndTimestamp: number;
  participants: ScoreboardParticipant[];
  lpChange: number | null;
};

function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function formatMatchDate(timestampMs: number) {
  return new Date(timestampMs).toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function MatchItem({
  match,
  trackedPuuid,
}: {
  match: MatchSummary;
  trackedPuuid: string;
}) {
  const [open, setOpen] = useState(false);
  const self = match.participants.find((p) => p.puuid === trackedPuuid);

  return (
    <div className="rounded-lg bg-black/20 border border-white/10 overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className={`w-full flex items-center gap-3 p-2.5 text-left transition hover:bg-white/5 border-l-4 ${
          match.win ? "border-l-emerald-500/60" : "border-l-red-500/60"
        }`}
      >
        <div className="text-[0.65rem] leading-tight text-white/40 w-14 shrink-0">
          <p>{formatDuration(match.durationSeconds)}</p>
          <p>{formatMatchDate(match.gameEndTimestamp)}</p>
        </div>

        <div className="relative w-10 h-10 shrink-0">
          {self?.championIconUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={self.championIconUrl} alt="" className="w-10 h-10 rounded-full" />
          )}
          <div className="absolute -bottom-1 -right-1 flex flex-col gap-0.5">
            {self?.summoner1IconUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={self.summoner1IconUrl}
                alt=""
                className="w-3.5 h-3.5 rounded border border-black/60"
              />
            )}
            {self?.summoner2IconUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={self.summoner2IconUrl}
                alt=""
                className="w-3.5 h-3.5 rounded border border-black/60"
              />
            )}
          </div>
        </div>

        <div className="flex flex-col gap-0.5 shrink-0">
          {self?.keystoneIconUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={self.keystoneIconUrl} alt="" className="w-4 h-4" />
          )}
          {self?.secondaryStyleIconUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={self.secondaryStyleIconUrl} alt="" className="w-4 h-4 opacity-70" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white">
            {match.kills}/<span className="text-red-400">{match.deaths}</span>/{match.assists}
            {self && (
              <span className="text-white/40 font-normal ml-1.5">{self.kdaRatio} KDA</span>
            )}
          </p>
          <p className="text-xs text-white/40">
            {self ? `${self.csPerMin} cs/m · ${self.killParticipation}% KP` : ""}
          </p>
        </div>

        {match.lpChange !== null && (
          <span
            className={`text-sm font-medium shrink-0 ${
              match.lpChange >= 0 ? "text-emerald-400" : "text-red-400"
            }`}
          >
            {match.lpChange >= 0 ? "+" : ""}
            {match.lpChange} LP
          </span>
        )}

        <span className="text-white/30 shrink-0 text-xs">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="border-t border-white/10 p-3">
          <MatchScoreboard participants={match.participants} trackedPuuid={trackedPuuid} />
        </div>
      )}
    </div>
  );
}
