import { NextRequest, NextResponse } from "next/server";
import { getCurrentTftSet } from "@/lib/riot";
import { deleteStalePreviousSetTftMatches } from "@/lib/kv";

export const maxDuration = 60;

/**
 * One-time (re-runnable) reclaim for the Redis storage used before raw match
 * blobs had a TTL (see RAW_MATCH_BLOB_TTL_SECONDS in riot.ts): deletes cached
 * TFT matches from a set that's no longer current, which the app can no
 * longer reach anyway (getTftRankedIndex stops at the set boundary). Reuses
 * CRON_SECRET rather than adding a second secret for a route nobody but an
 * operator calls.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization");
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const currentSet = await getCurrentTftSet();
  const result = await deleteStalePreviousSetTftMatches(currentSet);
  return NextResponse.json({ currentSet, ...result });
}
