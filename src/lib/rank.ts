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

const APEX_TIERS = ["MASTER", "GRANDMASTER", "CHALLENGER"];

/** totalLp() value at the moment a Diamond I player hits 100 LP and promotes into Master. */
const APEX_ENTRY_LP = TIER_ORDER.indexOf("DIAMOND") * 400 + RANK_ORDER.I * 100 + 100;

/**
 * Approximate real LP-equivalent, used to compute LP gaps between players.
 * Below Master this assumes the standard 100 LP per division (4 divisions
 * per tier). Master/Grandmaster/Challenger have no divisions — Riot's API
 * always reports rank "I" for them — so those tiers are instead treated as
 * a single open-ended climb continuing on from the point a Diamond I player
 * promotes at 100 LP, which keeps gaps across that boundary meaningful
 * instead of counting a full extra tier + division jump that doesn't exist.
 */
export function totalLp(ranked: RankedInfo | null): number | null {
  if (!ranked) return null;
  if (APEX_TIERS.includes(ranked.tier)) {
    return APEX_ENTRY_LP + ranked.leaguePoints;
  }
  const tierIndex = TIER_ORDER.indexOf(ranked.tier);
  const rankIndex = RANK_ORDER[ranked.rank] ?? 0;
  return tierIndex * 400 + rankIndex * 100 + ranked.leaguePoints;
}

export type LpGap = {
  toNext: number | null;
  toPrevious: number | null;
};

/**
 * Given a list of players sorted by elo (best first), computes for the
 * player at `index` how much LP separates them from their immediate
 * neighbors: `toNext` is LP needed to climb to the better-ranked neighbor
 * above, `toPrevious` is LP of cushion before dropping to the worse-ranked
 * neighbor below.
 */
export function computeLpGaps(sortedRanked: (RankedInfo | null)[]): LpGap[] {
  const sortedTotalLp = sortedRanked.map(totalLp);

  return sortedRanked.map((ranked, i) => {
    if (ranked === null) return { toNext: null, toPrevious: null };
    const lp = sortedTotalLp[i]!;

    let toNext: number | null = null;
    for (let j = i - 1; j >= 0; j--) {
      if (sortedTotalLp[j] !== null) {
        toNext = sortedTotalLp[j]! - lp;
        break;
      }
    }

    let toPrevious: number | null = null;
    for (let j = i + 1; j < sortedRanked.length; j++) {
      if (sortedTotalLp[j] !== null) {
        toPrevious = lp - sortedTotalLp[j]!;
        break;
      }
    }

    return { toNext, toPrevious };
  });
}
