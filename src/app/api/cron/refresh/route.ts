import { NextRequest, NextResponse, after } from "next/server";
import {
  getPlayers,
  getRefreshState,
  setRefreshState,
  touchCachedStats,
  type Player,
} from "@/lib/kv";
import {
  STATS_CACHE_TTL_SECONDS,
  checkLolPlayer,
  checkTftPlayer,
  computeLolStats,
  computeTftStats,
  lolStatsCacheKey,
  tftStatsCacheKey,
} from "@/lib/statsService";

export const maxDuration = 60;

const LOL_PLAYERS_KEY = "players:lol";
const TFT_PLAYERS_KEY = "players:tft";

// An unchanged player's cached stats get their expiry extended this often,
// comfortably before STATS_CACHE_TTL_SECONDS runs out.
const TOUCH_AFTER_MS = 2 * 60 * 60 * 1000;

type RefreshResult = { id: string; ok: boolean; skipped?: boolean; error?: string };

type Game<Profile> = {
  name: "lol" | "tft";
  cacheKey: (puuid: string, region: string) => string;
  check: (puuid: string, region: string) => Promise<{ signature: string; profile: Profile }>;
  // Resolves to false while the result is still partial and needs another run.
  compute: (puuid: string, region: string, profile: Profile) => Promise<boolean>;
};

/**
 * Refreshes every tracked player one at a time instead of in parallel.
 * Riot's per-key rate limit is shared across every player in the group, so
 * bursting N requests at once is what used to trip it when several browser
 * tabs polled together; a small stagger here keeps a single cron run safe
 * even as the roster grows.
 *
 * Players with nothing new are skipped: recomputing everyone on every run is
 * what used up Redis's monthly bandwidth in a few days.
 */
async function refreshAll<Profile>(
  players: Player[],
  game: Game<Profile>
): Promise<RefreshResult[]> {
  if (players.length === 0) return [];
  const state = await getRefreshState(game.name);
  let stateChanged = false;
  const results: RefreshResult[] = [];

  for (const { id, puuid, region } of players) {
    try {
      const { signature, profile } = await game.check(puuid, region);
      const previous = state[puuid];
      const unchanged = previous?.signature === signature;

      if (unchanged && Date.now() - previous.touchedAt < TOUCH_AFTER_MS) {
        results.push({ id, ok: true, skipped: true });
      } else if (
        unchanged &&
        (await touchCachedStats(game.cacheKey(puuid, region), STATS_CACHE_TTL_SECONDS))
      ) {
        state[puuid] = { signature, touchedAt: Date.now() };
        stateChanged = true;
        results.push({ id, ok: true, skipped: true });
      } else {
        if (await game.compute(puuid, region, profile)) {
          state[puuid] = { signature, touchedAt: Date.now() };
        } else {
          delete state[puuid];
        }
        stateChanged = true;
        results.push({ id, ok: true });
      }
    } catch (err) {
      results.push({
        id,
        ok: false,
        error: err instanceof Error ? err.message : "Error desconocido",
      });
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  if (stateChanged) await setRefreshState(game.name, state);
  return results;
}

type ProfileOf<Check extends (...args: never[]) => Promise<{ profile: unknown }>> = Awaited<
  ReturnType<Check>
>["profile"];

const LOL_GAME: Game<ProfileOf<typeof checkLolPlayer>> = {
  name: "lol",
  cacheKey: (puuid, region) => lolStatsCacheKey(puuid, region),
  check: checkLolPlayer,
  compute: async (puuid, region, profile) => {
    await computeLolStats(puuid, region, profile);
    return true;
  },
};

const TFT_GAME: Game<ProfileOf<typeof checkTftPlayer>> = {
  name: "tft",
  cacheKey: (puuid, region) => tftStatsCacheKey(puuid, region),
  check: checkTftPlayer,
  compute: async (puuid, region, profile) =>
    !(await computeTftStats(puuid, region, profile)).incomplete,
};

/**
 * Runs the same per-player stats computation the site does on page load, but
 * on a schedule (cron-job.org calls this route) instead of only when a
 * visitor has a tab open. This is what makes LP-per-match tracking and the
 * TFT match-history backfill reliable: Riot never exposes LP gained in a
 * single match directly, so trackLpPerMatch has to see the roster often
 * enough that at most one new ranked game appears between checks — otherwise
 * it can't tell which game caused the LP change and leaves it blank.
 *
 * `?game=lol` or `?game=tft` refreshes only that roster. The workflow calls
 * both in parallel as separate requests — as the tracked roster grew, doing
 * LoL and TFT together in one request (even though they already ran
 * concurrently inside it) started occasionally missing Vercel's 60s
 * (Hobby-plan) function timeout. Splitting them gives each its own 60s
 * budget instead of sharing one. Omitting the param keeps the old combined
 * behavior for manual/browser testing.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization");
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const game = req.nextUrl.searchParams.get("game");
  const runLol = game !== "tft";
  const runTft = game !== "lol";

  const [lolPlayers, tftPlayers] = await Promise.all([
    runLol ? getPlayers(LOL_PLAYERS_KEY) : Promise.resolve([]),
    runTft ? getPlayers(TFT_PLAYERS_KEY) : Promise.resolve([]),
  ]);

  // Respond right away and do the Riot calls after the response is sent.
  // External schedulers (cron-job.org's free plan cuts requests off at 30s)
  // would otherwise time out while the refresh is still running. The work
  // keeps its own maxDuration budget inside after().
  after(async () => {
    const [lol, tft] = await Promise.all([
      refreshAll(lolPlayers, LOL_GAME),
      refreshAll(tftPlayers, TFT_GAME),
    ]);
    const failed = [...lol, ...tft].filter((r) => !r.ok);
    const skipped = [...lol, ...tft].filter((r) => r.skipped).length;
    console.log(
      `[cron/refresh] game=${game ?? "all"} lol=${lol.length} tft=${tft.length} unchanged=${skipped} failed=${failed.length}`,
      failed.length ? JSON.stringify(failed) : ""
    );
  });

  return NextResponse.json({
    accepted: true,
    game: game ?? "all",
    lol: lolPlayers.length,
    tft: tftPlayers.length,
  });
}
