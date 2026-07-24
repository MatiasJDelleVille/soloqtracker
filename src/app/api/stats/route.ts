import { NextRequest, NextResponse } from "next/server";
import {
  getLatestDdragonVersion,
  getRankedEntries,
  getRecentRankedMatches,
  getSummonerProfile,
} from "@/lib/riot";
import { trackLpPerMatch } from "@/lib/kv";
import { totalLp } from "@/lib/rank";

export async function GET(req: NextRequest) {
  const puuid = req.nextUrl.searchParams.get("puuid");
  const region = req.nextUrl.searchParams.get("region");

  if (!puuid || !region) {
    return NextResponse.json({ error: "Faltan parámetros" }, { status: 400 });
  }

  try {
    const [ranked, matches, summoner, ddragonVersion] = await Promise.all([
      getRankedEntries(puuid, region),
      getRecentRankedMatches(puuid, region, 5),
      getSummonerProfile(puuid, region),
      getLatestDdragonVersion(),
    ]);

    const currentTotalLp = totalLp(ranked);
    const lpDeltas =
      currentTotalLp !== null
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
