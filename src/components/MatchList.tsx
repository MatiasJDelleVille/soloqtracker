"use client";

import { useState } from "react";
import MatchItem, { dayKey, formatDayHeader, type MatchSummary } from "./MatchItem";

export default function MatchList({
  matches,
  trackedPuuid,
  onLoadMore,
}: {
  matches: MatchSummary[];
  trackedPuuid: string;
  onLoadMore: () => Promise<number>;
}) {
  const [loadingMore, setLoadingMore] = useState(false);
  const [exhausted, setExhausted] = useState(false);

  if (matches.length === 0) {
    return <p className="text-white/40">Sin partidas recientes</p>;
  }

  const groups: { key: string; label: string; matches: MatchSummary[] }[] = [];
  for (const m of matches) {
    const key = dayKey(m.gameEndTimestamp);
    const group = groups[groups.length - 1];
    if (group && group.key === key) {
      group.matches.push(m);
    } else {
      groups.push({ key, label: formatDayHeader(m.gameEndTimestamp), matches: [m] });
    }
  }

  const handleLoadMore = async () => {
    setLoadingMore(true);
    try {
      const added = await onLoadMore();
      if (added === 0) setExhausted(true);
    } finally {
      setLoadingMore(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {groups.map((group) => (
        <div key={group.key} className="flex flex-col gap-2">
          <p className="text-sm font-semibold text-white/70">{group.label}</p>
          <div className="flex flex-col gap-2">
            {group.matches.map((m) => (
              <MatchItem key={m.matchId} match={m} trackedPuuid={trackedPuuid} />
            ))}
          </div>
        </div>
      ))}

      {!exhausted && (
        <button
          onClick={handleLoadMore}
          disabled={loadingMore}
          className="self-center text-sm text-white/50 hover:text-white transition px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 disabled:opacity-50"
        >
          {loadingMore ? "Cargando..." : "Cargar más"}
        </button>
      )}
    </div>
  );
}
