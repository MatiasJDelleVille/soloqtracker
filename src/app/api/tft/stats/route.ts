import { NextRequest, NextResponse } from "next/server";
import { getTftMatchDetails, getTftRankedIndex } from "@/lib/riot";
import { getCachedStats, getLpPerMatch, setCachedStats } from "@/lib/kv";
import { computeTftStats, tftStatsCacheKey } from "@/lib/statsService";

// Shared across every viewer so concurrent page loads (and the cron refresh)
// don't each hit the Riot API for the same data.
const STATS_CACHE_TTL_SECONDS = 20 * 60;
// While the match cache is still warming up the sample is partial, so it's
// only kept briefly and the next refresh fetches the next batch of matches.
const PARTIAL_STATS_CACHE_TTL_SECONDS = 60;
const PAGE_MATCH_COUNT = 5;

export async function GET(req: NextRequest) {
  const puuid = req.nextUrl.searchParams.get("puuid");
  const region = req.nextUrl.searchParams.get("region");
  const start = Number(req.nextUrl.searchParams.get("start") ?? "0");

  if (!puuid || !region) {
    return NextResponse.json({ error: "Faltan parámetros" }, { status: 400 });
  }

  const cacheKey = tftStatsCacheKey(puuid, region, start);
  const cached = await getCachedStats(cacheKey);
  if (cached) return NextResponse.json(cached);

  try {
    if (start === 0) {
      const body = await computeTftStats(puuid, region);
      return NextResponse.json(body);
    }

    // Older pages: nothing new to attribute, just the LP stored back when
    // those matches were fresh.
    const index = await getTftRankedIndex(puuid, region);
    const pageIds = index.rankedIds.slice(start, start + PAGE_MATCH_COUNT);
    const hasMore = start + PAGE_MATCH_COUNT < index.rankedIds.length;
    const ttl = index.incomplete ? PARTIAL_STATS_CACHE_TTL_SECONDS : STATS_CACHE_TTL_SECONDS;

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
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error desconocido" },
      { status: 500 }
    );
  }
}
