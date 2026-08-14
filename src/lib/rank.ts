export const TIER_ORDER = [
  "IRON",
  "BRONZE",
  "SILVER",
  "GOLD",
  "PLATINUM",
  "EMERALD",
  "DIAMOND",
  "MASTER",
  "GRANDMASTER",
  "CHALLENGER",
];

export const RANK_ORDER: Record<string, number> = { IV: 0, III: 1, II: 2, I: 3 };

export type RankedInfo = {
  tier: string;
  rank: string;
  leaguePoints: number;
  wins: number;
  losses: number;
};

/** Arbitrary scaled score used only to sort the table by elo (higher = better). */
export function eloScore(ranked: RankedInfo | null): number {
  if (!ranked) return -1;
  const tierIndex = TIER_ORDER.indexOf(ranked.tier);
  const rankScore = RANK_ORDER[ranked.rank] ?? 0;
  return tierIndex * 1000 + rankScore * 200 + ranked.leaguePoints;
}

/**
 * Approximate real LP-equivalent, assuming the standard 100 LP per division
 * (4 divisions per tier below Master). Used to compute LP gaps between players.
 */
export function totalLp(ranked: RankedInfo | null): number | null {
  if (!ranked) return null;
  const tierIndex = TIER_ORDER.indexOf(ranked.tier);
  const rankIndex = RANK_ORDER[ranked.rank] ?? 0;
  return tierIndex * 400 + rankIndex * 100 + ranked.leaguePoints;
}

export type LpGap = {
  toNext: number | null;
  toPrevious: number | null;
};

const APEX_TIERS = ["MASTER", "GRANDMASTER", "CHALLENGER"];

/**
 * Master/Grandmaster/Challenger don't have divisions — their LP isn't on the
 * same "400 units per tier" scale totalLp() assumes for the tiers below, so
 * a raw totalLp diff across that boundary (e.g. Diamond I vs Master I) wildly
 * overstates the real gap. Gaps are only meaningful within the same side of
 * that boundary.
 */
function comparableAcrossApexBoundary(a: RankedInfo | null, b: RankedInfo | null): boolean {
  if (!a || !b) return false;
  return APEX_TIERS.includes(a.tier) === APEX_TIERS.includes(b.tier);
}

/**
 * Given a list of players sorted by elo (best first), computes for the
 * player at `index` how much LP separates them from their immediate
 * neighbors: `toNext` is LP needed to climb to the better-ranked neighbor
 * above, `toPrevious` is LP of cushion before dropping to the worse-ranked
 * neighbor below. Both are null when the neighbor is on the other side of
 * the apex-tier boundary, where the comparison isn't meaningful.
 */
export function computeLpGaps(sortedRanked: (RankedInfo | null)[]): LpGap[] {
  const sortedTotalLp = sortedRanked.map(totalLp);

  return sortedRanked.map((ranked, i) => {
    if (ranked === null) return { toNext: null, toPrevious: null };
    const lp = sortedTotalLp[i]!;

    let toNext: number | null = null;
    for (let j = i - 1; j >= 0; j--) {
      if (sortedRanked[j] !== null) {
        if (comparableAcrossApexBoundary(ranked, sortedRanked[j])) {
          toNext = sortedTotalLp[j]! - lp;
        }
        break;
      }
    }

    let toPrevious: number | null = null;
    for (let j = i + 1; j < sortedRanked.length; j++) {
      if (sortedRanked[j] !== null) {
        if (comparableAcrossApexBoundary(ranked, sortedRanked[j])) {
          toPrevious = lp - sortedTotalLp[j]!;
        }
        break;
      }
    }

    return { toNext, toPrevious };
  });
}
