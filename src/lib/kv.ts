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

/**
 * Short-lived cache for a stats response, shared across every viewer. Without
 * this, each open browser tab independently re-hits the Riot API on its own
 * poll interval, so N friends viewing at once means N x the Riot calls for
 * the same data — that's what was tripping the per-second rate limit. A
 * short TTL keeps data close to live while letting concurrent viewers (and
 * quick client-side polling) share one upstream call.
 */
export async function getCachedStats<T>(key: string): Promise<T | null> {
  return (await redis.get<T>(key)) ?? null;
}

export async function setCachedStats(
  key: string,
  data: unknown,
  ttlSeconds: number
): Promise<void> {
  await redis.set(key, data, { ex: ttlSeconds });
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

/**
 * Match data is immutable once the game ends, so raw match-detail responses
 * are cached forever. This avoids re-hitting the Riot API for matches we've
 * already fetched on a previous page load or auto-refresh tick.
 */
export async function getCachedMatches(
  matchIds: string[]
): Promise<Record<string, unknown>> {
  if (matchIds.length === 0) return {};
  // A single MGET counts as one command against Upstash's request quota,
  // versus one GET per match id — with 10+ matches per player on every
  // cache-miss recompute, across many tracked players, that difference is
  // what was burning through the monthly command limit.
  const values = await redis.mget<unknown[]>(...matchIds.map((id) => `match:${id}`));
  const result: Record<string, unknown> = {};
  matchIds.forEach((id, i) => {
    if (values[i] != null) result[id] = values[i];
  });
  return result;
}

export async function cacheMatches(matches: Record<string, unknown>): Promise<void> {
  const entries = Object.entries(matches);
  if (entries.length === 0) return;
  // Same reasoning as getCachedMatches: one MSET instead of one SET per match.
  const kv: Record<string, unknown> = {};
  for (const [id, data] of entries) kv[`match:${id}`] = data;
  await redis.mset(kv);
}

type LpPointer = { lastMatchId: string; lastLp: number };

/**
 * Safety cap so one player's LP history can't grow without bound in Redis.
 * Entries are stored oldest-first, so trimming from the front drops the
 * matches nobody is going to scroll back to anyway.
 */
const LP_HISTORY_LIMIT = 1000;

async function readLpHistory(puuid: string): Promise<Record<string, number>> {
  const history = await redis.get<Record<string, number>>(`lp-history:${puuid}`);
  return history ?? {};
}

function pickDeltas(
  history: Record<string, number>,
  matchIds: string[]
): Record<string, number | null> {
  const result: Record<string, number | null> = {};
  for (const id of matchIds) result[id] = history[id] ?? null;
  return result;
}

/**
 * Read-only lookup of previously attributed LP deltas. Used for the older
 * pages of the match history, where there's nothing new to attribute but the
 * deltas we computed back when those matches were fresh are still valid.
 */
export async function getLpPerMatch(
  puuid: string,
  matchIds: string[]
): Promise<Record<string, number | null>> {
  if (matchIds.length === 0) return {};
  return pickDeltas(await readLpHistory(puuid), matchIds);
}

/**
 * Attributes LP gained/lost to a specific match. Riot's API never exposes
 * per-match LP directly, so this works by remembering the LP value right
 * after the last match we saw. On each call:
 *  - If exactly one new ranked match appeared since the last check, the LP
 *    delta (current - previous) is attributed to that match and stored.
 *  - If two or more new matches appeared at once (we didn't check often
 *    enough), we can't tell them apart, so those matches are left unknown
 *    rather than showing a misleading combined number.
 * Once a match's delta is computed it's stored permanently: the history is
 * only ever appended to, never rewritten to match the page being shown, so a
 * match keeps its LP number long after it falls off the first page.
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
    readLpHistory(puuid),
  ]);
  const nextHistory: Record<string, number> = { ...history };
  let changed = false;

  if (pointer && matchIdsNewestFirst.length > 0) {
    const idx = matchIdsNewestFirst.indexOf(pointer.lastMatchId);
    if (idx === 1) {
      nextHistory[matchIdsNewestFirst[0]] = currentTotalLp - pointer.lastLp;
      changed = true;
    }
    // idx === 0: nothing new since last check. idx === -1 or > 1: can't
    // attribute reliably, leave those matches without a known delta.
  }

  const keys = Object.keys(nextHistory);
  for (const stale of keys.slice(0, Math.max(0, keys.length - LP_HISTORY_LIMIT))) {
    delete nextHistory[stale];
    changed = true;
  }

  const writes: Promise<unknown>[] = [];
  if (matchIdsNewestFirst.length > 0) {
    writes.push(
      redis.set(pointerKey, {
        lastMatchId: matchIdsNewestFirst[0],
        lastLp: currentTotalLp,
      })
    );
  }
  if (changed) writes.push(redis.set(historyKey, nextHistory));
  await Promise.all(writes);

  return pickDeltas(nextHistory, matchIdsNewestFirst);
}
