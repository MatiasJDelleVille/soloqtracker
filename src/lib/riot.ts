const PLATFORM_TO_REGION: Record<string, string> = {
  na1: "americas",
  br1: "americas",
  la1: "americas",
  la2: "americas",
  oc1: "americas",
  euw1: "europe",
  eun1: "europe",
  tr1: "europe",
  ru: "europe",
  kr: "asia",
  jp1: "asia",
};

export const PLATFORMS = Object.keys(PLATFORM_TO_REGION);

function platformToRegion(platform: string): string {
  const region = PLATFORM_TO_REGION[platform];
  if (!region) throw new Error(`Unknown platform: ${platform}`);
  return region;
}

function apiKey(): string {
  const key = process.env.RIOT_API_KEY;
  if (!key) throw new Error("RIOT_API_KEY no está configurada");
  return key;
}

function tftApiKey(): string {
  const key = process.env.RIOT_TFT_API_KEY;
  if (!key) throw new Error("RIOT_TFT_API_KEY no está configurada");
  return key;
}

async function riotFetch(url: string, key: string = apiKey()) {
  const res = await fetch(url, {
    headers: { "X-Riot-Token": key },
    next: { revalidate: 0 },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Riot API ${res.status}: ${body}`);
  }
  return res.json();
}

export async function getAccountByRiotId(
  gameName: string,
  tagLine: string,
  platform: string,
  key?: string
) {
  const region = platformToRegion(platform);
  return riotFetch(
    `https://${region}.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(
      gameName
    )}/${encodeURIComponent(tagLine)}`,
    key
  ) as Promise<{ puuid: string; gameName: string; tagLine: string }>;
}

export async function getSummonerProfile(puuid: string, platform: string) {
  const summoner = (await riotFetch(
    `https://${platform}.api.riotgames.com/lol/summoner/v4/summoners/by-puuid/${puuid}`
  )) as { profileIconId: number; summonerLevel: number };
  return summoner;
}

let cachedDdragonVersion: string | null = null;

export async function getLatestDdragonVersion() {
  if (cachedDdragonVersion) return cachedDdragonVersion;
  const res = await fetch("https://ddragon.leagueoflegends.com/api/versions.json");
  const versions = (await res.json()) as string[];
  cachedDdragonVersion = versions[0];
  return cachedDdragonVersion;
}

export async function getRankedEntries(puuid: string, platform: string) {
  const entries = (await riotFetch(
    `https://${platform}.api.riotgames.com/lol/league/v4/entries/by-puuid/${puuid}`
  )) as Array<{
    queueType: string;
    tier: string;
    rank: string;
    leaguePoints: number;
    wins: number;
    losses: number;
  }>;
  return entries.find((e) => e.queueType === "RANKED_SOLO_5x5") ?? null;
}

export async function getRecentRankedMatches(
  puuid: string,
  platform: string,
  count = 5
) {
  const region = platformToRegion(platform);
  const matchIds = (await riotFetch(
    `https://${region}.api.riotgames.com/lol/match/v5/matches/by-puuid/${puuid}/ids?queue=420&start=0&count=${count}`
  )) as string[];

  const matches = await Promise.all(
    matchIds.map((id) =>
      riotFetch(`https://${region}.api.riotgames.com/lol/match/v5/matches/${id}`)
    )
  );

  return matches.map((match) => {
    const participant = match.info.participants.find(
      (p: { puuid: string }) => p.puuid === puuid
    );
    return {
      matchId: match.metadata.matchId,
      win: participant.win,
      championName: participant.championName,
      kills: participant.kills,
      deaths: participant.deaths,
      assists: participant.assists,
      durationSeconds: match.info.gameDuration,
      gameEndTimestamp: match.info.gameEndTimestamp,
    };
  });
}

export async function getAccountByRiotIdTft(
  gameName: string,
  tagLine: string,
  platform: string
) {
  return getAccountByRiotId(gameName, tagLine, platform, tftApiKey());
}

export async function getTftRankedEntries(puuid: string, platform: string) {
  const entries = (await riotFetch(
    `https://${platform}.api.riotgames.com/tft/league/v1/by-puuid/${puuid}`,
    tftApiKey()
  )) as Array<{
    queueType: string;
    tier: string;
    rank: string;
    leaguePoints: number;
    wins: number;
    losses: number;
  }>;
  return (
    entries.find((e) => e.queueType === "RANKED_TFT") ??
    entries.find((e) => e.queueType === "RANKED_TFT_DOUBLE_UP") ??
    null
  );
}

export async function getTftRecentMatches(
  puuid: string,
  platform: string,
  count = 5
) {
  const region = platformToRegion(platform);
  const key = tftApiKey();
  const matchIds = (await riotFetch(
    `https://${region}.api.riotgames.com/tft/match/v1/matches/by-puuid/${puuid}/ids?count=15`,
    key
  )) as string[];

  const matches = await Promise.all(
    matchIds.map((id) =>
      riotFetch(`https://${region}.api.riotgames.com/tft/match/v1/matches/${id}`, key)
    )
  );

  return matches
    .filter((match) => match.info.queue_id === 1100)
    .slice(0, count)
    .map((match) => {
      const participant = match.info.participants.find(
        (p: { puuid: string }) => p.puuid === puuid
      );
      return {
        matchId: match.metadata.match_id,
        placement: participant.placement,
        level: participant.level,
        gameLengthSeconds: Math.round(match.info.game_length),
        gameDatetime: match.info.game_datetime,
      };
    });
}
