import { NextRequest, NextResponse } from "next/server";
import {
  getLatestDdragonVersion,
  getRankedEntries,
  getRecentRankedMatches,
  getSummonerProfile,
} from "@/lib/riot";

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

    return NextResponse.json({
      ranked,
      matches,
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
