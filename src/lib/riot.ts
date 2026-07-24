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

let cachedChampionMap: Record<number, string> | null = null;

/** Maps championId -> Data Dragon champion key (e.g. 62 -> "MonkeyKing"), needed
 * because a few champion names don't match their ddragon asset key directly. */
export async function getChampionMap(): Promise<Record<number, string>> {
  if (cachedChampionMap) return cachedChampionMap;
  const version = await getLatestDdragonVersion();
  const res = await fetch(
    `https://ddragon.leagueoflegends.com/cdn/${version}/data/en_US/champion.json`
  );
  const data = (await res.json()) as { data: Record<string, { key: string; id: string }> };
  const map: Record<number, string> = {};
  for (const champ of Object.values(data.data)) {
    map[Number(champ.key)] = champ.id;
  }
  cachedChampionMap = map;
  return map;
}

export type RuneIcons = {
  keystone: string | null;
  secondaryStyleIcon: string | null;
};

let cachedRunesById: Record<number, string> | null = null;
let cachedStyleIconById: Record<number, string> | null = null;

async function loadRunesReforged() {
  if (cachedRunesById && cachedStyleIconById) return;
  const version = await getLatestDdragonVersion();
  const res = await fetch(
    `https://ddragon.leagueoflegends.com/cdn/${version}/data/en_US/runesReforged.json`
  );
  const styles = (await res.json()) as Array<{
    id: number;
    icon: string;
    slots: Array<{ runes: Array<{ id: number; icon: string }> }>;
  }>;

  const runesById: Record<number, string> = {};
  const styleIconById: Record<number, string> = {};
  for (const style of styles) {
    styleIconById[style.id] = style.icon;
    for (const slot of style.slots) {
      for (const rune of slot.runes) {
        runesById[rune.id] = rune.icon;
      }
    }
  }
  cachedRunesById = runesById;
  cachedStyleIconById = styleIconById;
}

export async function getRuneIconUrl(runeId: number): Promise<string | null> {
  await loadRunesReforged();
  const icon = cachedRunesById?.[runeId];
  return icon ? `https://ddragon.leagueoflegends.com/cdn/img/${icon}` : null;
}

export async function getRuneStyleIconUrl(styleId: number): Promise<string | null> {
  await loadRunesReforged();
  const icon = cachedStyleIconById?.[styleId];
  return icon ? `https://ddragon.leagueoflegends.com/cdn/img/${icon}` : null;
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

export async function getRecentRankedMatches(
  puuid: string,
  platform: string,
  count = 5
) {
  const region = platformToRegion(platform);
  const matchIds = (await riotFetch(
    `https://${region}.api.riotgames.com/lol/match/v5/matches/by-puuid/${puuid}/ids?queue=420&start=0&count=${count}`
  )) as string[];

  const [matches, championMap] = await Promise.all([
    Promise.all(
      matchIds.map((id) =>
        riotFetch(`https://${region}.api.riotgames.com/lol/match/v5/matches/${id}`)
      )
    ),
    getChampionMap(),
  ]);
  await loadRunesReforged();

  return Promise.all(
    matches.map(async (match) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const allParticipants = match.info.participants as any[];
      const participant = allParticipants.find((p) => p.puuid === puuid);

      const teamKills: Record<number, number> = {};
      for (const p of allParticipants) {
        teamKills[p.teamId] = (teamKills[p.teamId] ?? 0) + p.kills;
      }

      const durationMinutes = match.info.gameDuration / 60;

      const participants: ScoreboardParticipant[] = await Promise.all(
        allParticipants.map(async (p) => {
          const cs = p.totalMinionsKilled + p.neutralMinionsKilled;
          const kp =
            teamKills[p.teamId] > 0
              ? Math.round(((p.kills + p.assists) / teamKills[p.teamId]) * 100)
              : 0;
          const keystoneId = p.perks?.styles?.[0]?.selections?.[0]?.perk;
          const secondaryStyleId = p.perks?.styles?.[1]?.style;
          return {
            puuid: p.puuid,
            name: p.riotIdGameName
              ? `${p.riotIdGameName}#${p.riotIdTagline}`
              : p.summonerName || "—",
            championIconUrl: championMap[p.championId]
              ? `https://ddragon.leagueoflegends.com/cdn/${await getLatestDdragonVersion()}/img/champion/${championMap[p.championId]}.png`
              : null,
            kills: p.kills,
            deaths: p.deaths,
            assists: p.assists,
            kdaRatio: Math.round(((p.kills + p.assists) / Math.max(p.deaths, 1)) * 100) / 100,
            cs,
            csPerMin: Math.round((cs / durationMinutes) * 10) / 10,
            killParticipation: kp,
            teamId: p.teamId,
            win: p.win,
            keystoneIconUrl: keystoneId ? await getRuneIconUrl(keystoneId) : null,
            secondaryStyleIconUrl: secondaryStyleId
              ? await getRuneStyleIconUrl(secondaryStyleId)
              : null,
          };
        })
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
        participants,
      };
    })
  );
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
