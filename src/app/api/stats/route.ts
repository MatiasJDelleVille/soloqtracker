import { NextRequest, NextResponse } from "next/server";
import {
  getLatestDdragonVersion,
  getRankedEntries,
  getRecentRankedMatches,
  getSummonerProfile,
} from "@/lib/riot";
import { trackLpPerMatch } from "@/lib/kv";
import { totalLp } from "@/lib/rank";

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

  try {
    const [ranked, matches, summoner, ddragonVersion] = await Promise.all([
      getRankedEntries(puuid, region),
      getRecentRankedMatches(puuid, region, count, start),
      getSummonerProfile(puuid, region),
      getLatestDdragonVersion(),
    ]);

    // LP deltas are only attributable relative to the newest-match pointer,
    // so tracking is only meaningful for the first page (start === 0).
    const currentTotalLp = totalLp(ranked);
    const lpDeltas =
      start === 0 && currentTotalLp !== null
        ? await trackLpPerMatch(
            puuid,
            matches.map((m) => m.matchId),
            currentTotalLp
          )
        : {};

    const matchesWithLp = matches.map((m) => ({
      ...m,
      lpChange: lpDeltas[m.matchId] ?? null,
    }));

    return NextResponse.json({
      ranked,
      matches: matchesWithLp,
      profileIconId: summoner.profileIconId,
      ddragonVersion,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error desconocido" },
      { status: 500 }
    );
  }
}
