import {
  getLatestDdragonVersion,
  getLatestRankedMatchId,
  getLatestTftMatchId,
  getRankedEntries,
  getRecentRankedMatches,
  getSummonerProfile,
  getTftRankedEntries,
  getTftMatchDetails,
  getTftRankedIndex,
  getTftSummonerProfile,
} from "@/lib/riot";
import { getLpPerMatch, setCachedStats, trackLpPerMatch } from "@/lib/kv";
import { totalLp } from "@/lib/rank";
import type { TftStats } from "@/lib/tft";

const INITIAL_MATCH_COUNT = 10;
// The cron rewrites these as soon as a player's data changes and otherwise just
// extends them, so they can outlive many cron runs.
export const STATS_CACHE_TTL_SECONDS = 3 * 60 * 60;
// While the match cache is still warming up the sample is partial, so it's
// only kept briefly and the next refresh (cron or page load) fetches more.
const TFT_PARTIAL_STATS_CACHE_TTL_SECONDS = 60;

export function lolStatsCacheKey(puuid: string, region: string, start = 0) {
  return `stats-cache:${puuid}:${region}:${start}`;
}

// Bumped whenever the response shape grows, so stale bodies cached under the
// previous key (e.g. without profile icons) aren't served until they expire.
export function tftStatsCacheKey(puuid: string, region: string, start = 0) {
  return `tft-stats-cache:v5:${puuid}:${region}:${start}`;
}

type LolProfile = {
  ranked: Awaited<ReturnType<typeof getRankedEntries>>;
  summoner: Awaited<ReturnType<typeof getSummonerProfile>>;
};

type TftProfile = {
  ranked: Awaited<ReturnType<typeof getTftRankedEntries>>;
  summoner: Awaited<ReturnType<typeof getTftSummonerProfile>>;
};

/**
 * Everything that can change a player's first-page stats, read from Riot
 * without touching Redis. While the signature stays the same there's nothing to
 * recompute. The profile is returned so a recompute doesn't ask Riot twice.
 */
export async function checkLolPlayer(puuid: string, region: string) {
  const [latestMatchId, ranked, summoner, ddragonVersion] = await Promise.all([
    getLatestRankedMatchId(puuid, region),
    getRankedEntries(puuid, region),
    getSummonerProfile(puuid, region),
    getLatestDdragonVersion(),
  ]);
  const profile: LolProfile = { ranked, summoner };
  return {
    signature: JSON.stringify([latestMatchId, ranked, summoner.profileIconId, ddragonVersion]),
    profile,
  };
}

export async function checkTftPlayer(puuid: string, region: string) {
  const [latestMatchId, ranked, summoner, ddragonVersion] = await Promise.all([
    getLatestTftMatchId(puuid, region),
    getTftRankedEntries(puuid, region),
    getTftSummonerProfile(puuid, region),
    getLatestDdragonVersion(),
  ]);
  const profile: TftProfile = { ranked, summoner };
  return {
    signature: JSON.stringify([latestMatchId, ranked, summoner.profileIconId, ddragonVersion]),
    profile,
  };
}

/**
 * Computes and caches the first-page LoL stats for a player. Shared by the
 * on-demand /api/stats route and the background cron refresh so both write
 * the exact same cache entry and feed the same LP-tracking pointer.
 */
export async function computeLolStats(puuid: string, region: string, known?: LolProfile) {
  const [ranked, matches, summoner, ddragonVersion] = await Promise.all([
    known ? known.ranked : getRankedEntries(puuid, region),
    getRecentRankedMatches(puuid, region, INITIAL_MATCH_COUNT, 0),
    known ? known.summoner : getSummonerProfile(puuid, region),
    getLatestDdragonVersion(),
  ]);

  const currentTotalLp = totalLp(ranked);
  const matchIds = matches.map((m) => m.matchId);
  const lpDeltas =
    currentTotalLp !== null
      ? await trackLpPerMatch(puuid, matchIds, currentTotalLp)
      : await getLpPerMatch(puuid, matchIds);

  const matchesWithLp = matches.map((m) => ({
    ...m,
    lpChange: lpDeltas[m.matchId] ?? null,
  }));

  const body = {
    ranked,
    matches: matchesWithLp,
    profileIconId: summoner.profileIconId,
    ddragonVersion,
  };
  await setCachedStats(lolStatsCacheKey(puuid, region), body, STATS_CACHE_TTL_SECONDS);
  return body;
}

/**
 * Computes and caches the first-page TFT stats for a player. Each call also
 * extends the ranked match index a bit further back (see getTftRankedIndex),
 * so calling this regularly — not just when someone has the page open — is
 * what eventually indexes every ranked game of the set instead of only the
 * ones a visitor happened to trigger.
 */
export async function computeTftStats(puuid: string, region: string, known?: TftProfile) {
  const index = await getTftRankedIndex(puuid, region);
  const pageIds = index.rankedIds.slice(0, INITIAL_MATCH_COUNT);
  const hasMore = INITIAL_MATCH_COUNT < index.rankedIds.length;
  const ttl = index.incomplete ? TFT_PARTIAL_STATS_CACHE_TTL_SECONDS : STATS_CACHE_TTL_SECONDS;

  const [ranked, summoner, ddragonVersion, details] = await Promise.all([
    known ? known.ranked : getTftRankedEntries(puuid, region),
    known ? known.summoner : getTftSummonerProfile(puuid, region),
    getLatestDdragonVersion(),
    getTftMatchDetails(puuid, region, pageIds),
  ]);

  // Only standard ranked LP can be attributed to the ranked matches shown;
  // the Double Up fallback entry climbs on a separate ladder.
  const currentTotalLp = ranked?.queueType === "RANKED_TFT" ? totalLp(ranked) : null;
  const lpDeltas =
    currentTotalLp !== null
      ? await trackLpPerMatch(puuid, index.rankedIds, currentTotalLp, "tft")
      : await getLpPerMatch(puuid, pageIds, "tft");

  const games = index.placements.length;

  const body: NonNullable<TftStats> = {
    ranked,
    profileIconId: summoner.profileIconId,
    ddragonVersion,
    incomplete: index.incomplete,
    hasMore,
    summary: {
      games,
      avgPlacement: games > 0 ? index.placements.reduce((a, b) => a + b, 0) / games : null,
      winRate: games > 0 ? index.placements.filter((p) => p === 1).length / games : null,
      top4Rate: games > 0 ? index.placements.filter((p) => p <= 4).length / games : null,
    },
    matches: details.map((m) => ({ ...m, lpChange: lpDeltas[m.matchId] ?? null })),
  };
  await setCachedStats(tftStatsCacheKey(puuid, region), body, ttl);
  return body;
}
