export interface MatchInfo {
  homeTeam: string;
  awayTeam: string;
  homeTeamLogo?: string;
  awayTeamLogo?: string;
  matchDate: string;
  matchTime: string;
  kickoffISO: string;
  competition: string;
  broadcasters: string[];
  broadcastersDetailed?: Array<{
    name: string;
    logo?: string;
  }>;
  locationCity?: string;
  locationState?: string;
  locationStadium?: string;
  sourceUrl: string;
  fetchedAt: string;
  sourceHeadline?: string;
  sourceSummary?: string;
  fetchError?: string;
}

export interface TeamMatchesResponse {
  team: string;
  total: number;
  matches: MatchInfo[];
}

export interface TeamsResponse {
  total: number;
  teams: string[];
}
