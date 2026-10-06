import { NextRequest, NextResponse } from "next/server";
import { getRecentRankedMatches } from "@/lib/riot";
import { getCachedStats, getLpPerMatch, setCachedStats } from "@/lib/kv";
import { computeLolStats, lolStatsCacheKey } from "@/lib/statsService";

const PAGE_MATCH_COUNT = 5;

// Shared across every viewer so concurrent page loads (and the cron refresh)
// don't each hit the Riot API for the same data.
const STATS_CACHE_TTL_SECONDS = 20 * 60;

export async function GET(req: NextRequest) {
  const puuid = req.nextUrl.searchParams.get("puuid");
  const region = req.nextUrl.searchParams.get("region");
  const start = Number(req.nextUrl.searchParams.get("start") ?? "0");

  if (!puuid || !region) {
    return NextResponse.json({ error: "Faltan parámetros" }, { status: 400 });
  }

  const cacheKey = lolStatsCacheKey(puuid, region, start);
  const cached = await getCachedStats(cacheKey);
  if (cached) return NextResponse.json(cached);

  try {
    if (start === 0) {
      const body = await computeLolStats(puuid, region);
      return NextResponse.json(body);
    }

    // Older pages: nothing new to attribute, just the LP stored back when
    // those matches were fresh.
    const matches = await getRecentRankedMatches(puuid, region, PAGE_MATCH_COUNT, start);
    const matchIds = matches.map((m) => m.matchId);
    const lpDeltas = await getLpPerMatch(puuid, matchIds);
    const matchesWithLp = matches.map((m) => ({ ...m, lpChange: lpDeltas[m.matchId] ?? null }));
    const responseBody = { matches: matchesWithLp };
    await setCachedStats(cacheKey, responseBody, STATS_CACHE_TTL_SECONDS);
    return NextResponse.json(responseBody);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error desconocido" },
      { status: 500 }
    );
  }
}
