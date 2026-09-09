import { NextRequest, NextResponse } from "next/server";
import {
  getLatestDdragonVersion,
  getRankedEntries,
  getRecentRankedMatches,
  getSummonerProfile,
} from "@/lib/riot";
import { getCachedStats, getLpPerMatch, setCachedStats, trackLpPerMatch } from "@/lib/kv";
import { totalLp } from "@/lib/rank";

const INITIAL_MATCH_COUNT = 10;
const PAGE_MATCH_COUNT = 5;

// Shared across every viewer so concurrent page loads (and the client's own
// poll interval) don't each hit the Riot API for the same data. Matches the
// client's polling cadence so a cache-miss recompute happens roughly once
// per poll cycle instead of piling up extra ones inside the same window.
const STATS_CACHE_TTL_SECONDS = 20 * 60;

export async function GET(req: NextRequest) {
  const puuid = req.nextUrl.searchParams.get("puuid");
  const region = req.nextUrl.searchParams.get("region");
  const start = Number(req.nextUrl.searchParams.get("start") ?? "0");
  const count = start === 0 ? INITIAL_MATCH_COUNT : PAGE_MATCH_COUNT;

  if (!puuid || !region) {
    return NextResponse.json({ error: "Faltan parámetros" }, { status: 400 });
  }

  const cacheKey = `stats-cache:${puuid}:${region}:${start}`;
  const cached = await getCachedStats(cacheKey);
  if (cached) return NextResponse.json(cached);

  try {
    const [ranked, matches, summoner, ddragonVersion] = await Promise.all([
      getRankedEntries(puuid, region),
      getRecentRankedMatches(puuid, region, count, start),
      getSummonerProfile(puuid, region),
      getLatestDdragonVersion(),
    ]);

    // New LP deltas are only attributable relative to the newest-match
    // pointer, so tracking only runs on the first page. Older pages still get
    // whatever was attributed to those matches back when they were fresh.
    const currentTotalLp = totalLp(ranked);
    const matchIds = matches.map((m) => m.matchId);
    const lpDeltas =
      start === 0 && currentTotalLp !== null
        ? await trackLpPerMatch(puuid, matchIds, currentTotalLp)
        : await getLpPerMatch(puuid, matchIds);

    const matchesWithLp = matches.map((m) => ({
      ...m,
      lpChange: lpDeltas[m.matchId] ?? null,
    }));

    const responseBody = {
      ranked,
      matches: matchesWithLp,
      profileIconId: summoner.profileIconId,
      ddragonVersion,
    };
    await setCachedStats(cacheKey, responseBody, STATS_CACHE_TTL_SECONDS);
    return NextResponse.json(responseBody);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error desconocido" },
      { status: 500 }
    );
  }
}
