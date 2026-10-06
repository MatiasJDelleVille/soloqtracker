"use client";

import { useEffect, useState } from "react";

/**
 * Data now refreshes on its own via a server-side cron (see
 * src/app/api/cron/refresh), so viewers don't need to reload the page for
 * LP tracking to stay accurate — this just shows when the next update lands.
 */
export default function NextUpdateTimer({
  lastLoadAt,
  intervalMs,
}: {
  lastLoadAt: number | null;
  intervalMs: number;
}) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  if (lastLoadAt === null) return null;

  const remainingMs = Math.max(0, lastLoadAt + intervalMs - now);
  const totalSeconds = Math.ceil(remainingMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return (
    <p className="text-white/30 text-sm mb-6">
      Próxima actualización en {minutes}:{seconds.toString().padStart(2, "0")}
    </p>
  );
}
