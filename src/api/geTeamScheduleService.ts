import got from 'got';
import vm from 'node:vm';

interface RawContestant {
  popularName?: string;
  name?: string;
  badgePng?: string;
  badgeSvg?: string;
}

interface RawMatch {
  firstContestant?: RawContestant;
  secondContestant?: RawContestant;
  startDate?: string;
  startHour?: string;
  liveWatchSources?: Array<{ name?: string; officialLogoUrl?: string; highlightLogoUrl?: string }>;
  transmission?: {
    url?: string;
    broadcastStatus?: { label?: string };
  };
  location?: {
    popularName?: string;
    stadium?: { name?: string };
    city?: { name?: string };
    state?: { name?: string };
  };
  phase?: {
    name?: string;
    championshipEdition?: {
      championship?: { name?: string };
    };
  };
}

interface RawEvent {
  editorialData?: {
    url?: string;
    title?: string;
    subtitle?: string;
  };
  match?: RawMatch;
}

interface DataSportsSchedule {
  scheduleTeam?: {
    teamAgenda?: {
      future?: RawEvent[];
    };
  };
}

export interface ScheduleMatch {
  homeTeam: string;
  awayTeam: string;
  homeTeamLogo?: string;
  awayTeamLogo?: string;
  startDate?: string;
  startHour?: string;
  competition?: string;
  broadcasters: string[];
  broadcasterEntries: Array<{ name: string; logo?: string }>;
  venue?: string;
  city?: string;
  state?: string;
  phase?: string;
  sourceUrl: string;
  sourceTitle?: string;
  sourceSubtitle?: string;
  timestamp: number;
}

const TEAM_SLUG_OVERRIDES: Record<string, string> = {
  'vasco da gama': 'vasco',
  'red bull bragantino': 'bragantino'
};

const DATA_BLOCK_REGEX = /window\.dataSportsSchedule\s*=\s*(\{[\s\S]*?\});/;
const BASE_URL = 'https://ge.globo.com/futebol/times';

export class GeTeamScheduleService {
  private readonly cache = new Map<string, { expiresAt: number; matches: ScheduleMatch[] }>();
  private readonly cacheTtlMs = 5 * 60 * 1000;

  private sanitizeLogoUrl(url?: string): string | undefined {
    if (!url) return undefined;
    let normalized = url.trim();
    if (!normalized) return undefined;
    if (normalized.startsWith('//')) {
      normalized = `https:${normalized}`;
    }
    if (!/^https?:\/\//i.test(normalized)) {
      return undefined;
    }
    return normalized;
  }

  async fetchTeamMatches(teamName: string): Promise<ScheduleMatch[]> {
    const slug = this.resolveSlug(teamName);
    if (!slug) {
      throw new Error(`Não encontramos uma agenda oficial para ${teamName}`);
    }

    const cached = this.cache.get(slug);
    const now = Date.now();
    if (cached && cached.expiresAt > now) {
      return cached.matches;
    }

    const scheduleUrl = `${BASE_URL}/${slug}/agenda-de-jogos-do-${slug}/#/proximos-jogos`;
    let html: string;
    try {
      const response = await got(scheduleUrl, {
        timeout: { request: 10000 }
      });
      html = response.body;
    } catch (error) {
      console.error({ error, scheduleUrl }, 'Falha ao buscar agenda oficial');
      throw new Error(`Não foi possível acessar a agenda oficial do ${teamName}`);
    }

    const matches = this.extractMatches(html, scheduleUrl);

    this.cache.set(slug, {
      expiresAt: now + this.cacheTtlMs,
      matches
    });

    return matches;
  }

  private extractMatches(html: string, fallbackUrl: string): ScheduleMatch[] {
    const match = html.match(DATA_BLOCK_REGEX);
    if (!match) {
      throw new Error('Bloco de agenda não encontrado na página');
    }

    const script = new vm.Script(
      `const window = {}; window.dataSportsSchedule = ${match[1]}; window.dataSportsSchedule;`
    );

    const data = script.runInNewContext({}) as DataSportsSchedule;
    const futureEvents = data.scheduleTeam?.teamAgenda?.future ?? [];

    return futureEvents
      .map(event => this.normalizeEvent(event, fallbackUrl))
      .filter((item): item is ScheduleMatch => item !== null);
  }

  private normalizeEvent(event: RawEvent, fallbackUrl: string): ScheduleMatch | null {
    const match = event.match;
    if (!match) return null;

    const homeTeam = this.pickContestant(match.firstContestant);
    const awayTeam = this.pickContestant(match.secondContestant);
    if (!homeTeam || !awayTeam) {
      return null;
    }

    const startDate = match.startDate;
    const startHour = match.startHour ?? '00:00:00';
    const timestamp = this.parseTimestamp(startDate, startHour);

    const broadcasterEntries =
      match.liveWatchSources?.map(source => ({
        name: source.name?.trim() ?? '',
        logo: this.sanitizeLogoUrl(source.officialLogoUrl || source.highlightLogoUrl)
      })) ?? [];

    const broadcasters = Array.from(
      new Set(broadcasterEntries.map(entry => entry.name).filter((value): value is string => Boolean(value)))
    );

    const sourceUrl = event.editorialData?.url || match.transmission?.url || fallbackUrl;

    return {
      homeTeam,
      awayTeam,
      homeTeamLogo: this.sanitizeLogoUrl(match.firstContestant?.badgePng || match.firstContestant?.badgeSvg),
      awayTeamLogo: this.sanitizeLogoUrl(match.secondContestant?.badgePng || match.secondContestant?.badgeSvg),
      startDate,
      startHour,
      competition: match.phase?.championshipEdition?.championship?.name,
      broadcasters,
      broadcasterEntries: broadcasterEntries.filter(entry => entry.name),
      venue: match.location?.stadium?.name || match.location?.popularName,
      city: match.location?.city?.name,
      state: match.location?.state?.name,
      phase: match.phase?.name,
      sourceUrl,
      sourceTitle: event.editorialData?.title,
      sourceSubtitle: event.editorialData?.subtitle,
      timestamp
    };
  }

  private pickContestant(contestant?: RawContestant): string | null {
    if (!contestant) return null;
    return contestant.popularName || contestant.name || null;
  }

  private parseTimestamp(date?: string, hour?: string): number {
    if (!date) return Number.MAX_SAFE_INTEGER;
    const dateTime = `${date}T${hour ?? '00:00:00'}`;
    const parsed = Date.parse(dateTime);
    return Number.isNaN(parsed) ? Number.MAX_SAFE_INTEGER : parsed;
  }

  private resolveSlug(teamName: string): string | undefined {
    const normalized = GeTeamScheduleService.normalizeString(teamName);
    if (TEAM_SLUG_OVERRIDES[normalized]) {
      return TEAM_SLUG_OVERRIDES[normalized];
    }
    const fallback = GeTeamScheduleService.slugify(teamName);
    return fallback || undefined;
  }

  private static normalizeString(value: string): string {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
  }

  private static slugify(value: string): string {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .replace(/--+/g, '-');
  }
}
