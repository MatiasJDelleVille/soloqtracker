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

/**
 * Tracks LP over time so we can show "LP change since last check". Riot's API
 * only exposes current LP, not a per-match history, so this is a snapshot
 * comparison rather than a true per-game delta.
 */
export async function getLpChange(
  puuid: string,
  currentTotalLp: number
): Promise<number | null> {
  const snapKey = `lp-snapshot:${puuid}`;
  const previous = await redis.get<number>(snapKey);
  await redis.set(snapKey, currentTotalLp);
  if (previous === null || previous === undefined) return null;
  return currentTotalLp - previous;
}
