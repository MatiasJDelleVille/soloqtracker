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

export function formatRelativeTime(timestampMs: number) {
  const diffMs = Date.now() - timestampMs;
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 60) return `hace ${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `hace ${hours}h`;
  const days = Math.floor(hours / 24);
  return `hace ${days}d`;
}

export function formatDayHeader(timestampMs: number) {
  const label = new Date(timestampMs).toLocaleDateString("es-AR", {
    day: "numeric",
    month: "short",
  });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function dayKey(timestampMs: number) {
  const d = new Date(timestampMs);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
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
  const opponent =
    self?.position &&
    match.participants.find(
      (p) => p.teamId !== self.teamId && p.position === self.position
    );

  return (
    <div
      className={`rounded-xl border overflow-hidden ${
        match.win
          ? "bg-emerald-500/[0.06] border-emerald-500/20"
          : "bg-red-500/[0.06] border-red-500/20"
      }`}
    >
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-4 px-4 py-3 text-left transition hover:bg-white/5"
      >
        <div className="text-xs text-white/40 w-16 shrink-0 leading-tight">
          <p className="font-medium text-white/60">{formatDuration(match.durationSeconds)}</p>
          <p>{formatRelativeTime(match.gameEndTimestamp)}</p>
        </div>

        <div className="relative w-11 h-11 shrink-0">
          {self?.championIconUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={self.championIconUrl}
              alt=""
              className={`w-11 h-11 rounded-full border-2 ${
                match.win ? "border-emerald-500/50" : "border-red-500/50"
              }`}
            />
          )}
          <div className="absolute -bottom-1 -right-1 flex gap-0.5">
            {self?.summoner1IconUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={self.summoner1IconUrl}
                alt=""
                className="w-4 h-4 rounded border border-black/60"
              />
            )}
            {self?.summoner2IconUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={self.summoner2IconUrl}
                alt=""
                className="w-4 h-4 rounded border border-black/60"
              />
            )}
          </div>
        </div>

        <div className="flex flex-col gap-1 shrink-0">
          {self?.keystoneIconUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={self.keystoneIconUrl} alt="" className="w-5 h-5" />
          )}
          {self?.secondaryStyleIconUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={self.secondaryStyleIconUrl} alt="" className="w-4 h-4 opacity-70" />
          )}
        </div>

        <div className="w-24 shrink-0">
          <p className="text-base font-semibold text-white whitespace-nowrap">
            {match.kills}/<span className="text-red-400">{match.deaths}</span>/{match.assists}
          </p>
          {self && <p className="text-xs text-white/40">{self.kdaRatio} KDA</p>}
        </div>

        <div className="w-28 shrink-0 text-xs text-white/50 hidden sm:block">
          {self && (
            <>
              <p>{self.csPerMin} cs/min</p>
              <p>{self.killParticipation}% KP</p>
            </>
          )}
        </div>

        {opponent && (
          <div className="flex items-center gap-2 shrink-0 hidden md:flex">
            <span className="text-[0.65rem] text-white/30">vs</span>
            {opponent.championIconUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={opponent.championIconUrl}
                alt=""
                className="w-8 h-8 rounded-full border border-white/10"
              />
            )}
          </div>
        )}

        <div className="flex-1" />

        {match.lpChange !== null && (
          <span
            className={`text-sm font-semibold shrink-0 ${
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
        <div className="border-t border-white/10 p-3 bg-black/20">
          <MatchScoreboard participants={match.participants} trackedPuuid={trackedPuuid} />
        </div>
      )}
    </div>
  );
}
