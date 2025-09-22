import fs from 'fs';
import * as CsvWriter from 'csv-writer';
import { DateTime } from 'luxon';
import { MatchItem } from '../types';

const OUTPUT_PATH = 'result/matches.csv';

type CsvRecord = {
  homeTeam: string;
  awayTeam: string;
  matchDate: string;
  matchTime: string;
  dateTimeUtc: string;
  competition: string;
  whereToWatch: string;
  sourceUrl: string;
};

const csvWriter = CsvWriter.createObjectCsvWriter<CsvRecord>({
  path: OUTPUT_PATH,
  header: [
    { id: 'homeTeam', title: 'HomeTeam' },
    { id: 'awayTeam', title: 'AwayTeam' },
    { id: 'matchDate', title: 'MatchDate' },
    { id: 'matchTime', title: 'MatchTime' },
    { id: 'dateTimeUtc', title: 'DateTimeUTC' },
    { id: 'competition', title: 'Competition' },
    { id: 'whereToWatch', title: 'WhereToWatch' },
    { id: 'sourceUrl', title: 'SourceUrl' }
  ],
  append: true
});

const existingKeys = new Set<string>();

function stripQuotes(value?: string) {
  if (!value) return '';
  return value.replace(/^"/, '').replace(/"$/, '').trim();
}

function normalize(value?: string | null) {
  return value ? value.trim().toLowerCase() : '';
}

function buildMatchKeyFromValues(
  homeTeam: string,
  awayTeam: string,
  dateTimeLocal: string,
  dateTimeUtc: string,
  sourceUrl: string
): string | undefined {
  const home = normalize(homeTeam);
  const away = normalize(awayTeam);
  const when = normalize(dateTimeUtc) || normalize(dateTimeLocal);
  const source = normalize(sourceUrl);
  const pivot = when || source;
  if (!home || !away || !pivot) return undefined;
  return `${home}|${away}|${pivot}`;
}

function buildMatchKey(match: MatchItem): string | undefined {
  const home = normalize(match.homeTeam);
  const away = normalize(match.awayTeam);
  const when = normalize(match.dateTimeUtc ?? match.dateTimeLocal);
  const source = normalize(match.sourceUrl);
  const pivot = when || source;
  if (!home || !away || !pivot) return undefined;
  return `${home}|${away}|${pivot}`;
}

function bootstrapExistingKeys() {
  try {
    if (!fs.existsSync(OUTPUT_PATH)) return;
    const data = fs.readFileSync(OUTPUT_PATH, 'utf8');
    const lines = data.split(/\r?\n/);

    for (const line of lines) {
      if (!line.trim()) continue;
      if (!line.includes(',')) continue;
      if (line.startsWith('HomeTeam,')) continue;

      const parts = line.split(',');
      if (parts.length < 7) continue;

      const homeTeam = stripQuotes(parts[0]);
      const awayTeam = stripQuotes(parts[1]);
      let dateTimeLocalValue = '';
      let dateTimeUtcValue = '';
      let sourceUrlValue = '';

      if (parts.length >= 8) {
        const matchDate = stripQuotes(parts[2]);
        const matchTime = stripQuotes(parts[3]);
        dateTimeLocalValue = [matchDate, matchTime].filter(Boolean).join(' ').trim();
        dateTimeUtcValue = stripQuotes(parts[4]);
        sourceUrlValue = stripQuotes(parts[7]);
      } else {
        dateTimeLocalValue = stripQuotes(parts[2]);
        dateTimeUtcValue = stripQuotes(parts[3]);
        sourceUrlValue = stripQuotes(parts[6]);
      }

      const key = buildMatchKeyFromValues(
        homeTeam,
        awayTeam,
        dateTimeLocalValue,
        dateTimeUtcValue,
        sourceUrlValue
      );

      if (key) existingKeys.add(key);
    }
  } catch (err) {
    console.error('Failed to bootstrap CSV dedupe cache:', err);
  }
}

function deriveLocalDateAndTime(match: MatchItem) {
  const candidateIso = match.dateTimeLocal ?? match.dateTimeUtc;
  if (!candidateIso) return {} as { matchDate?: string; matchTime?: string };

  let dt = DateTime.fromISO(candidateIso, { setZone: true });
  if (!dt.isValid) {
    dt = DateTime.fromISO(candidateIso, { zone: 'utc' });
  }
  if (!dt.isValid) return {} as { matchDate?: string; matchTime?: string };

  const local = dt.setZone('America/Sao_Paulo');
  return {
    matchDate: local.toFormat('dd/LL/yyyy'),
    matchTime: local.toFormat('HH:mm')
  };
}

function formatWhereToWatch(list?: MatchItem['whereToWatch']) {
  if (!list?.length) return '';
  const providers = list
    .map(item => item?.provider?.trim())
    .filter((provider): provider is string => Boolean(provider));
  if (!providers.length) return '';
  const uniqueProviders = Array.from(new Set(providers));
  return uniqueProviders.join('|');
}

function formatMatchForCsv(match: MatchItem): CsvRecord {
  const { matchDate = '', matchTime = '' } = deriveLocalDateAndTime(match);

  return {
    homeTeam: match.homeTeam ?? '',
    awayTeam: match.awayTeam ?? '',
    matchDate,
    matchTime,
    dateTimeUtc: match.dateTimeUtc ?? '',
    competition: match.competition ?? '',
    whereToWatch: formatWhereToWatch(match.whereToWatch),
    sourceUrl: match.sourceUrl
  };
}

bootstrapExistingKeys();

export async function saveMatchesToCsv(matches: MatchItem[]) {
  if (!matches.length) return;

  const uniqueMatches: MatchItem[] = [];

  for (const match of matches) {
    const key = buildMatchKey(match);
    if (!key) continue;
    if (existingKeys.has(key)) continue;
    existingKeys.add(key);
    uniqueMatches.push(match);
  }

  if (!uniqueMatches.length) return;

  const records = uniqueMatches.map(formatMatchForCsv);

  await csvWriter.writeRecords(records);
}
