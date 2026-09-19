import { NextRequest, NextResponse } from "next/server";
import {
  getLatestDdragonVersion,
  getTftRankedEntries,
  getTftMatchDetails,
  getTftRankedIndex,
  getTftSummonerProfile,
} from "@/lib/riot";
import { getCachedStats, getLpPerMatch, setCachedStats, trackLpPerMatch } from "@/lib/kv";
import { totalLp } from "@/lib/rank";
import type { TftStats } from "@/lib/tft";

// Shared across every viewer so concurrent page loads (and the client's own
// poll interval) don't each hit the Riot API for the same data. Matches the
// client's polling cadence so a cache-miss recompute happens roughly once
// per poll cycle instead of piling up extra ones inside the same window.
const STATS_CACHE_TTL_SECONDS = 20 * 60;
// While the match cache is still warming up the sample is partial, so it's
// only kept briefly and the next load fetches the next batch of matches.
const PARTIAL_STATS_CACHE_TTL_SECONDS = 60;
const INITIAL_MATCH_COUNT = 10;
const PAGE_MATCH_COUNT = 5;

export async function GET(req: NextRequest) {
  const puuid = req.nextUrl.searchParams.get("puuid");
  const region = req.nextUrl.searchParams.get("region");
  const start = Number(req.nextUrl.searchParams.get("start") ?? "0");
  const count = start === 0 ? INITIAL_MATCH_COUNT : PAGE_MATCH_COUNT;

  if (!puuid || !region) {
    return NextResponse.json({ error: "Faltan parámetros" }, { status: 400 });
  }

  // Bumped whenever the response shape grows, so stale bodies cached under the
  // previous key (e.g. without profile icons) aren't served until they expire.
  const cacheKey = `tft-stats-cache:v5:${puuid}:${region}:${start}`;
  const cached = await getCachedStats(cacheKey);
  if (cached) return NextResponse.json(cached);

  try {
    const index = await getTftRankedIndex(puuid, region);
    const pageIds = index.rankedIds.slice(start, start + count);
    const hasMore = start + count < index.rankedIds.length;
    const ttl = index.incomplete ? PARTIAL_STATS_CACHE_TTL_SECONDS : STATS_CACHE_TTL_SECONDS;

    // Older pages: nothing new to attribute, just the LP stored back when
    // those matches were fresh.
    if (start > 0) {
      const [details, lpDeltas] = await Promise.all([
        getTftMatchDetails(puuid, pageIds),
        getLpPerMatch(puuid, pageIds, "tft"),
      ]);
      const body = {
        matches: details.map((m) => ({ ...m, lpChange: lpDeltas[m.matchId] ?? null })),
        hasMore,
      };
      await setCachedStats(cacheKey, body, ttl);
      return NextResponse.json(body);
    }

    const [ranked, summoner, ddragonVersion, details] = await Promise.all([
      getTftRankedEntries(puuid, region),
      getTftSummonerProfile(puuid, region),
      getLatestDdragonVersion(),
      getTftMatchDetails(puuid, pageIds),
    ]);

    // Only standard ranked LP can be attributed to the ranked matches shown;
    // the Double Up fallback entry climbs on a separate ladder.
    const currentTotalLp = ranked?.queueType === "RANKED_TFT" ? totalLp(ranked) : null;
    const lpDeltas =
      currentTotalLp !== null
        ? await trackLpPerMatch(puuid, index.rankedIds, currentTotalLp, "tft")
        : await getLpPerMatch(puuid, pageIds, "tft");

    // In TFT ranked, Riot counts every top-4 finish as a "win".
    const rankedGames = ranked ? ranked.wins + ranked.losses : 0;
    const games = index.placements.length;

    const responseBody: NonNullable<TftStats> = {
      ranked,
      profileIconId: summoner.profileIconId,
      ddragonVersion,
      incomplete: index.incomplete,
      hasMore,
      summary: {
        games,
        avgPlacement: games > 0 ? index.placements.reduce((a, b) => a + b, 0) / games : null,
        winRate: games > 0 ? index.placements.filter((p) => p === 1).length / games : null,
        top4Rate: ranked && rankedGames > 0 ? ranked.wins / rankedGames : null,
      },
      matches: details.map((m) => ({ ...m, lpChange: lpDeltas[m.matchId] ?? null })),
    };

    await setCachedStats(cacheKey, responseBody, ttl);
    return NextResponse.json(responseBody);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error desconocido" },
      { status: 500 }
    );
  }
}
