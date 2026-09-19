export type TftTrait = {
  name: string;
  displayName: string;
  numUnits: number;
  style: number;
  icon: string | null;
};

export type TftItem = {
  name: string;
  displayName: string;
  icon: string | null;
};

export type TftUnit = {
  characterId: string;
  name: string;
  tier: number;
  cost: number;
  icon: string | null;
  items: TftItem[];
};

export type TftLobbyPlayer = {
  puuid: string;
  gameName: string;
  tagLine: string;
  avatar: string | null;
  placement: number;
  level: number;
  lastRound: number;
  timeEliminated: number;
  playersEliminated: number;
  boardValue: number;
  traits: TftTrait[];
  units: TftUnit[];
};

export type TftMatch = {
  matchId: string;
  placement: number;
  level: number;
  lastRound: number;
  gameLengthSeconds: number;
  gameDatetime: number;
  lpChange: number | null;
  participants: TftLobbyPlayer[];
};

export type TftRanked = {
  tier: string;
  rank: string;
  leaguePoints: number;
  wins: number;
  losses: number;
};

export type TftSummary = {
  games: number;
  avgPlacement: number | null;
  winRate: number | null;
  top4Rate: number | null;
};

export type TftStats = {
  ranked: TftRanked | null;
  summary: TftSummary;
  matches: TftMatch[];
  profileIconId: number;
  ddragonVersion: string;
  // Some recent matches aren't indexed yet, so the summary is still partial.
  incomplete: boolean;
  hasMore: boolean;
} | null;

const PLATFORM_TO_METATFT: Record<string, string> = {
  na1: "na",
  br1: "br",
  la1: "lan",
  la2: "las",
  oc1: "oce",
  euw1: "euw",
  eun1: "eune",
  tr1: "tr",
  ru: "ru",
  kr: "kr",
  jp1: "jp",
};

export function metaTftProfileUrl(player: { region: string; game_name: string; tag_line: string }) {
  const region = PLATFORM_TO_METATFT[player.region] ?? player.region;
  return `https://www.metatft.com/player/${region}/${encodeURIComponent(
    player.game_name
  )}-${encodeURIComponent(player.tag_line)}`;
}

export function formatPercent(rate: number) {
  return `${(rate * 100).toFixed(1)}%`;
}
