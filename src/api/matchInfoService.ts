import { GeTeamScheduleService, ScheduleMatch } from './geTeamScheduleService';

export interface BaseMatchRecord {
  homeTeam: string;
  awayTeam: string;
  matchDate: string;
  matchTime: string;
  kickoffISO: string;
  competition: string;
  broadcasters: string[];
  sourceUrl: string;
}

export interface EnrichedMatchRecord extends BaseMatchRecord {
  fetchedAt: string;
  sourceHeadline?: string;
  sourceSummary?: string;
  fetchError?: string;
  homeTeamLogo?: string;
  awayTeamLogo?: string;
  broadcastersDetailed?: Array<{ name: string; logo?: string }>;
  locationCity?: string;
  locationState?: string;
  locationStadium?: string;
}

const BRASILEIRAO_TEAMS = [
  'America-MG',
  'Athletico-PR',
  'Atletico-GO',
  'Atletico-MG',
  'Bahia',
  'Botafogo',
  'Corinthians',
  'Cruzeiro',
  'Cuiaba',
  'Flamengo',
  'Fluminense',
  'Fortaleza',
  'Gremio',
  'Internacional',
  'Juventude',
  'Palmeiras',
  'Red Bull Bragantino',
  'Santos',
  'Sao Paulo',
  'Vasco da Gama'
];

export class MatchInfoService {
  private readonly scheduleService: GeTeamScheduleService;
  private readonly rangeWindowMs = 14 * 24 * 60 * 60 * 1000;

  constructor(scheduleService = new GeTeamScheduleService()) {
    this.scheduleService = scheduleService;
  }

  async getUpcomingMatches(team: string, limit = 3): Promise<EnrichedMatchRecord[]> {
    const scheduleMatches = await this.scheduleService.fetchTeamMatches(team);
    const now = Date.now();
    const rangeEnd = now + this.rangeWindowMs;

    const filtered = scheduleMatches
      .filter(match => match.timestamp >= now && match.timestamp <= rangeEnd)
      .sort((a, b) => a.timestamp - b.timestamp)
      .slice(0, Math.max(1, limit));

    return filtered.map(match => this.transformScheduleMatch(match));
  }

  private transformScheduleMatch(match: ScheduleMatch): EnrichedMatchRecord {
    const kickoffDate = this.toDate(match);
    const matchDate = kickoffDate ? kickoffDate.toLocaleDateString('pt-BR') : 'Data a definir';
    const matchTime = kickoffDate
      ? kickoffDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', hour12: false })
      : match.startHour?.slice(0, 5) ?? 'Horario a definir';
    const kickoffISO = kickoffDate ? kickoffDate.toISOString() : '';

    return {
      homeTeam: match.homeTeam,
      awayTeam: match.awayTeam,
      matchDate,
      matchTime,
      kickoffISO,
      competition: match.competition ?? 'Competicao nao informada',
      broadcasters: match.broadcasters.length > 0 ? match.broadcasters : ['Nao informado'],
      sourceUrl: match.sourceUrl,
      fetchedAt: new Date().toISOString(),
      sourceHeadline: match.sourceTitle,
      sourceSummary: match.sourceSubtitle,
      homeTeamLogo: match.homeTeamLogo,
      awayTeamLogo: match.awayTeamLogo,
      broadcastersDetailed:
        match.broadcasterEntries.length > 0
          ? match.broadcasterEntries
          : match.broadcasters.map(name => ({ name })),
      locationCity: match.city,
      locationState: match.state,
      locationStadium: match.venue
    };
  }

  private toDate(match: ScheduleMatch): Date | null {
    if (!match.startDate) return null;
    const iso = `${match.startDate}T${match.startHour ?? '00:00:00'}`;
    const date = new Date(iso);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  async listTeams(): Promise<string[]> {
    return [...BRASILEIRAO_TEAMS].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }
}
