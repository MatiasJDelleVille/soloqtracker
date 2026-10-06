import { NextRequest, NextResponse } from "next/server";
import { getPlayers, type Player } from "@/lib/kv";
import { computeLolStats, computeTftStats } from "@/lib/statsService";

export const maxDuration = 60;

const LOL_PLAYERS_KEY = "players:lol";
const TFT_PLAYERS_KEY = "players:tft";

type RefreshResult = { id: string; ok: boolean; error?: string };

/**
 * Refreshes every tracked player one at a time instead of in parallel.
 * Riot's per-key rate limit is shared across every player in the group, so
 * bursting N requests at once is what used to trip it when several browser
 * tabs polled together; a small stagger here keeps a single cron run safe
 * even as the roster grows.
 */
async function refreshAll(
  players: Player[],
  compute: (puuid: string, region: string) => Promise<unknown>
): Promise<RefreshResult[]> {
  const results: RefreshResult[] = [];
  for (const player of players) {
    try {
      await compute(player.puuid, player.region);
      results.push({ id: player.id, ok: true });
    } catch (err) {
      results.push({
        id: player.id,
        ok: false,
        error: err instanceof Error ? err.message : "Error desconocido",
      });
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  return results;
}

/**
 * Runs the same per-player stats computation the site does on page load, but
 * on a schedule (see .github/workflows/refresh.yml) instead of only when a
 * visitor has a tab open. This is what makes LP-per-match tracking and the
 * TFT match-history backfill reliable: Riot never exposes LP gained in a
 * single match directly, so trackLpPerMatch has to see the roster often
 * enough that at most one new ranked game appears between checks — otherwise
 * it can't tell which game caused the LP change and leaves it blank.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization");
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const [lolPlayers, tftPlayers] = await Promise.all([
    getPlayers(LOL_PLAYERS_KEY),
    getPlayers(TFT_PLAYERS_KEY),
  ]);

  const [lol, tft] = await Promise.all([
    refreshAll(lolPlayers, computeLolStats),
    refreshAll(tftPlayers, computeTftStats),
  ]);

  return NextResponse.json({
    lol: { total: lol.length, ok: lol.filter((r) => r.ok).length, results: lol },
    tft: { total: tft.length, ok: tft.filter((r) => r.ok).length, results: tft },
  });
}
