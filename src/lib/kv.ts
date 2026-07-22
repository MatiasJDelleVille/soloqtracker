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
