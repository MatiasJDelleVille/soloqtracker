"use client";

import { useState } from "react";

export type ScoreboardParticipant = {
  puuid: string;
  name: string;
  championIconUrl: string | null;
  summoner1IconUrl: string | null;
  summoner2IconUrl: string | null;
  kills: number;
  deaths: number;
  assists: number;
  kdaRatio: number;
  cs: number;
  csPerMin: number;
  killParticipation: number;
  teamId: number;
  win: boolean;
  itemIconUrls: string[];
  keystoneIconUrl: string | null;
  secondaryStyleIconUrl: string | null;
  primaryStyleIconUrl: string | null;
  primaryRuneIconUrls: string[];
  secondaryRuneIconUrls: string[];
  statShardIconUrls: string[];
};

function TeamAccent({ teamId }: { teamId: number }) {
  return teamId === 100 ? "border-l-blue-500/60" : "border-l-red-500/60";
}

function GeneralRow({
  p,
  tracked,
}: {
  p: ScoreboardParticipant;
  tracked: boolean;
}) {
  return (
    <div
      className={`flex items-center gap-2 text-sm px-2 py-1.5 rounded-md border-l-4 ${TeamAccent({
        teamId: p.teamId,
      })} ${tracked ? "bg-white/15 ring-1 ring-white/20" : "bg-black/20"}`}
    >
      {p.championIconUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={p.championIconUrl} alt="" className="w-7 h-7 rounded-full shrink-0" />
      )}
      <div className="flex flex-col gap-0.5 shrink-0">
        {p.keystoneIconUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={p.keystoneIconUrl} alt="" className="w-3.5 h-3.5" />
        )}
        {p.secondaryStyleIconUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={p.secondaryStyleIconUrl} alt="" className="w-3.5 h-3.5 opacity-70" />
        )}
      </div>
      <span
        className={`flex-1 min-w-0 truncate ${tracked ? "text-white font-semibold" : "text-white/80"}`}
      >
        {p.name}
      </span>
      <span className="w-16 text-right text-white/70 shrink-0">
        {p.kills}/<span className="text-red-400">{p.deaths}</span>/{p.assists}
      </span>
      <span className="w-14 text-right text-white/50 shrink-0 hidden sm:inline">
        {p.csPerMin} cs/m
      </span>
      <span className="w-12 text-right text-white/50 shrink-0">{p.killParticipation}%</span>
      <div className="flex gap-0.5 shrink-0 w-[7.5rem] justify-end">
        {p.itemIconUrls.map((url, i) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={i} src={url} alt="" className="w-5 h-5 rounded shrink-0" />
        ))}
      </div>
    </div>
  );
}

function RuneCard({ p, tracked }: { p: ScoreboardParticipant; tracked: boolean }) {
  return (
    <div
      className={`flex flex-col items-center gap-1.5 w-32 shrink-0 text-center px-2 py-2 rounded-md border-l-4 ${TeamAccent(
        { teamId: p.teamId }
      )} ${tracked ? "bg-white/15 ring-1 ring-white/20" : "bg-black/20"}`}
    >
      <div className="flex items-center gap-1.5">
        {p.championIconUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={p.championIconUrl} alt="" className="w-6 h-6 rounded-full" />
        )}
        <span
          className={`text-xs truncate max-w-[4.5rem] ${tracked ? "text-white font-semibold" : "text-white/70"}`}
        >
          {p.name.split("#")[0]}
        </span>
      </div>

      <div className="flex items-center gap-1">
        {p.primaryStyleIconUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={p.primaryStyleIconUrl} alt="" className="w-4 h-4" />
        )}
        <div className="flex gap-0.5">
          {p.primaryRuneIconUrls.map((url, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={i}
              src={url}
              alt=""
              className={i === 0 ? "w-5 h-5" : "w-3.5 h-3.5 opacity-80"}
            />
          ))}
        </div>
      </div>

      <div className="flex items-center gap-1">
        {p.secondaryStyleIconUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={p.secondaryStyleIconUrl} alt="" className="w-3.5 h-3.5 opacity-70" />
        )}
        <div className="flex gap-0.5">
          {p.secondaryRuneIconUrls.map((url, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={i} src={url} alt="" className="w-3.5 h-3.5 opacity-80" />
          ))}
        </div>
      </div>

      <div className="flex gap-1">
        {p.statShardIconUrls.map((url, i) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={i} src={url} alt="" className="w-3 h-3 rounded-full bg-black/40" />
        ))}
      </div>
    </div>
  );
}

export default function MatchScoreboard({
  participants,
  trackedPuuid,
}: {
  participants: ScoreboardParticipant[];
  trackedPuuid: string;
}) {
  const [tab, setTab] = useState<"general" | "runas">("general");

  if (!participants || participants.length === 0) return null;

  const teamIds = Array.from(new Set(participants.map((p) => p.teamId))).sort();

  return (
    <div>
      <div className="flex gap-1 mb-2">
        {(["general", "runas"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`text-xs font-medium px-2.5 py-1 rounded-md transition ${
              tab === t
                ? "bg-white/20 text-white"
                : "text-white/40 hover:text-white/70 hover:bg-white/5"
            }`}
          >
            {t === "general" ? "General" : "Runas"}
          </button>
        ))}
      </div>

      {tab === "general" && (
        <div className="overflow-x-auto">
          <div className="flex flex-col md:flex-row gap-4 w-max min-w-full">
            {teamIds.map((teamId) => {
              const teamParticipants = participants.filter((p) => p.teamId === teamId);
              const win = teamParticipants[0]?.win;
              return (
                <div key={teamId} className="w-[26rem] shrink-0">
                  <p
                    className={`text-sm font-semibold mb-1 ${
                      win ? "text-emerald-400" : "text-red-400"
                    }`}
                  >
                    {win ? "Victoria" : "Derrota"}
                  </p>
                  <div className="flex flex-col gap-1">
                    {teamParticipants.map((p) => (
                      <GeneralRow key={p.puuid} p={p} tracked={p.puuid === trackedPuuid} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {tab === "runas" && (
        <div className="overflow-x-auto">
          <div className="flex flex-col gap-3 w-max min-w-full">
            {teamIds.map((teamId) => {
              const teamParticipants = participants.filter((p) => p.teamId === teamId);
              const win = teamParticipants[0]?.win;
              return (
                <div key={teamId}>
                  <p
                    className={`text-sm font-semibold mb-1 ${
                      win ? "text-emerald-400" : "text-red-400"
                    }`}
                  >
                    {win ? "Victoria" : "Derrota"}
                  </p>
                  <div className="flex gap-2">
                    {teamParticipants.map((p) => (
                      <RuneCard key={p.puuid} p={p} tracked={p.puuid === trackedPuuid} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
