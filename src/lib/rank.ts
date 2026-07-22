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

/**
 * Given a list of players sorted by elo (best first), each with a nullable
 * totalLp, computes for the player at `index` how much LP separates them
 * from their immediate neighbors: `toNext` is LP needed to climb to the
 * better-ranked neighbor above, `toPrevious` is LP of cushion before
 * dropping to the worse-ranked neighbor below.
 */
export function computeLpGaps(sortedTotalLp: (number | null)[]): LpGap[] {
  return sortedTotalLp.map((lp, i) => {
    if (lp === null) return { toNext: null, toPrevious: null };

    let toNext: number | null = null;
    for (let j = i - 1; j >= 0; j--) {
      if (sortedTotalLp[j] !== null) {
        toNext = sortedTotalLp[j]! - lp;
        break;
      }
    }

    let toPrevious: number | null = null;
    for (let j = i + 1; j < sortedTotalLp.length; j++) {
      if (sortedTotalLp[j] !== null) {
        toPrevious = lp - sortedTotalLp[j]!;
        break;
      }
    }

    return { toNext, toPrevious };
  });
}
