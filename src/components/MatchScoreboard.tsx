export type ScoreboardParticipant = {
  puuid: string;
  name: string;
  championIconUrl: string | null;
  kills: number;
  deaths: number;
  assists: number;
  kdaRatio: number;
  cs: number;
  csPerMin: number;
  killParticipation: number;
  teamId: number;
  win: boolean;
  keystoneIconUrl: string | null;
  secondaryStyleIconUrl: string | null;
};

function TeamBlock({
  participants,
  trackedPuuid,
}: {
  participants: ScoreboardParticipant[];
  trackedPuuid: string;
}) {
  const win = participants[0]?.win;

  return (
    <div className="flex-1 min-w-0">
      <p className={`text-sm font-semibold mb-1 ${win ? "text-emerald-400" : "text-red-400"}`}>
        {win ? "Victoria" : "Derrota"}
      </p>
      <div className="flex flex-col gap-1">
        {participants.map((p) => (
          <div
            key={p.puuid}
            className={`flex items-center gap-2 text-sm px-1.5 py-1 rounded-md ${
              p.puuid === trackedPuuid ? "bg-white/10" : ""
            }`}
          >
            {p.championIconUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={p.championIconUrl}
                alt=""
                className="w-6 h-6 rounded-full shrink-0"
              />
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
            <span className="flex-1 min-w-0 truncate text-white/80">{p.name}</span>
            <span className="w-16 text-right text-white/70 shrink-0">
              {p.kills}/{p.deaths}/{p.assists}
            </span>
            <span className="w-14 text-right text-white/50 shrink-0 hidden sm:inline">
              {p.csPerMin} cs/m
            </span>
            <span className="w-12 text-right text-white/50 shrink-0">{p.killParticipation}%</span>
          </div>
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
  if (!participants || participants.length === 0) return null;

  const teamIds = Array.from(new Set(participants.map((p) => p.teamId))).sort();

  return (
    <div className="flex flex-col md:flex-row gap-4">
      {teamIds.map((teamId) => (
        <TeamBlock
          key={teamId}
          participants={participants.filter((p) => p.teamId === teamId)}
          trackedPuuid={trackedPuuid}
        />
      ))}
    </div>
  );
}
