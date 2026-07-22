import { NextRequest, NextResponse } from "next/server";
import { getTftRankedEntries, getTftRecentMatches } from "@/lib/riot";

export async function GET(req: NextRequest) {
  const puuid = req.nextUrl.searchParams.get("puuid");
  const region = req.nextUrl.searchParams.get("region");

  if (!puuid || !region) {
    return NextResponse.json({ error: "Faltan parámetros" }, { status: 400 });
  }

  try {
    const [ranked, matches] = await Promise.all([
      getTftRankedEntries(puuid, region),
      getTftRecentMatches(puuid, region, 5),
    ]);

    return NextResponse.json({ ranked, matches });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error desconocido" },
      { status: 500 }
    );
  }
}
