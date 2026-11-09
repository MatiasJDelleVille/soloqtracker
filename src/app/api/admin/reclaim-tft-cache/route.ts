import { NextRequest, NextResponse } from "next/server";
import { getCurrentTftSet } from "@/lib/riot";
import { deleteStaleLolMatches, deleteStalePreviousSetTftMatches } from "@/lib/kv";

export const maxDuration = 60;

const LOL_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * One-time (re-runnable) reclaim for the Redis storage used before raw match
 * blobs had a TTL (see RAW_MATCH_BLOB_TTL_SECONDS in riot.ts):
 *  - TFT matches from a set that's no longer current, unreachable by the app
 *    anyway (getTftRankedIndex stops at the set boundary).
 *  - LoL matches older than 30 days (no "set" boundary to key off, so this
 *    uses each blob's own gameCreation timestamp instead).
 * Reuses CRON_SECRET rather than adding a second secret for a route nobody
 * but an operator calls.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization");
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const currentSet = await getCurrentTftSet();
  const [tft, lol] = await Promise.all([
    deleteStalePreviousSetTftMatches(currentSet),
    deleteStaleLolMatches(LOL_MAX_AGE_MS),
  ]);
  return NextResponse.json({ currentSet, tft, lol });
}

