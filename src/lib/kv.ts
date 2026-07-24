import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.KV_REST_API_URL!,
  token: process.env.KV_REST_API_TOKEN!,
});

export type Player = {
  id: string;
  game_name: string;
  tag_line: string;
  puuid: string;
  region: string;
  created_at: string;
};

async function getList(key: string): Promise<Player[]> {
  const list = await redis.get<Player[]>(key);
  return list ?? [];
}

export async function getPlayers(key: string): Promise<Player[]> {
  const list = await getList(key);
  return list.slice().sort((a, b) => a.created_at.localeCompare(b.created_at));
}

export async function addPlayer(
  key: string,
  data: { game_name: string; tag_line: string; puuid: string; region: string }
): Promise<Player> {
  const list = await getList(key);
  const player: Player = {
    id: crypto.randomUUID(),
    created_at: new Date().toISOString(),
    ...data,
  };
  list.push(player);
  await redis.set(key, list);
  return player;
}

export async function removePlayer(key: string, id: string): Promise<void> {
  const list = await getList(key);
  await redis.set(
    key,
    list.filter((p) => p.id !== id)
  );
}

type LpPointer = { lastMatchId: string; lastLp: number };

/**
 * Attributes LP gained/lost to a specific match. Riot's API never exposes
 * per-match LP directly, so this works by remembering the LP value right
 * after the last match we saw. On each call:
 *  - If exactly one new ranked match appeared since the last check, the LP
 *    delta (current - previous) is attributed to that match and stored.
 *  - If two or more new matches appeared at once (we didn't check often
 *    enough), we can't tell them apart, so those matches are left unknown
 *    rather than showing a misleading combined number.
 * Once a match's delta is computed it's cached, so it stays correct/stable
 * across reloads instead of only reflecting "since the last page load".
 *
 * `matchIdsNewestFirst` must be the recent ranked match ids, newest first.
 * Returns a map of matchId -> LP delta (null if unknown).
 */
export async function trackLpPerMatch(
  puuid: string,
  matchIdsNewestFirst: string[],
  currentTotalLp: number
): Promise<Record<string, number | null>> {
  const pointerKey = `lp-pointer:${puuid}`;
  const historyKey = `lp-history:${puuid}`;

  const [pointer, history] = await Promise.all([
    redis.get<LpPointer>(pointerKey),
    redis.get<Record<string, number>>(historyKey),
  ]);
  const nextHistory: Record<string, number> = { ...(history ?? {}) };

  if (pointer && matchIdsNewestFirst.length > 0) {
    const idx = matchIdsNewestFirst.indexOf(pointer.lastMatchId);
    if (idx === 1) {
      nextHistory[matchIdsNewestFirst[0]] = currentTotalLp - pointer.lastLp;
    }
    // idx === 0: nothing new since last check. idx === -1 or > 1: can't
    // attribute reliably, leave those matches without a known delta.
  }

  // Keep the history capped to the matches we actually display.
  const prunedHistory: Record<string, number> = {};
  for (const id of matchIdsNewestFirst) {
    if (id in nextHistory) prunedHistory[id] = nextHistory[id];
  }

  await Promise.all([
    matchIdsNewestFirst.length > 0
      ? redis.set(pointerKey, { lastMatchId: matchIdsNewestFirst[0], lastLp: currentTotalLp })
      : Promise.resolve(),
    redis.set(historyKey, prunedHistory),
  ]);

  const result: Record<string, number | null> = {};
  for (const id of matchIdsNewestFirst) {
    result[id] = prunedHistory[id] ?? null;
  }
  return result;
}
