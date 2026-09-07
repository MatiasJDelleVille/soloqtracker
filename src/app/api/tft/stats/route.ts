import { NextRequest, NextResponse } from "next/server";
import { getTftRankedEntries, getTftRecentMatches } from "@/lib/riot";
import { getCachedStats, setCachedStats } from "@/lib/kv";

// Shared across every viewer so concurrent page loads (and the client's own
// poll interval) don't each hit the Riot API for the same data.
const STATS_CACHE_TTL_SECONDS = 45;

export async function GET(req: NextRequest) {
  const puuid = req.nextUrl.searchParams.get("puuid");
  const region = req.nextUrl.searchParams.get("region");

  if (!puuid || !region) {
    return NextResponse.json({ error: "Faltan parámetros" }, { status: 400 });
  }

  const cacheKey = `tft-stats-cache:${puuid}:${region}`;
  const cached = await getCachedStats(cacheKey);
  if (cached) return NextResponse.json(cached);

  try {
    const [ranked, matches] = await Promise.all([
      getTftRankedEntries(puuid, region),
      getTftRecentMatches(puuid, region, 5),
    ]);

    const responseBody = { ranked, matches };
    await setCachedStats(cacheKey, responseBody, STATS_CACHE_TTL_SECONDS);
    return NextResponse.json(responseBody);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error desconocido" },
      { status: 500 }
    );
  }
}
