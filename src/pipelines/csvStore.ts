import fs from 'fs';
import * as CsvWriter from 'csv-writer';
import { DateTime } from 'luxon';
import { MatchItem } from '../types';

const CSV_OUTPUT_PATH = 'result/matches.csv';

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
  path: CSV_OUTPUT_PATH,
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

const existingMatchKeys = new Set<string>();

function stripSurroundingQuotes(value?: string) {
  if (!value) return '';
  return value.replace(/^"/, '').replace(/"$/, '').trim();
}

function normalizeKeyValue(value?: string | null) {
  return value ? value.trim().toLowerCase() : '';
}

function buildMatchKeyFromRawValues(
  homeTeam: string,
  awayTeam: string,
  dateTimeLocal: string,
  dateTimeUtc: string,
  sourceUrl: string
): string | undefined {
  const normalizedHome = normalizeKeyValue(homeTeam);
  const normalizedAway = normalizeKeyValue(awayTeam);
  const normalizedDate = normalizeKeyValue(dateTimeUtc) || normalizeKeyValue(dateTimeLocal);
  const normalizedSource = normalizeKeyValue(sourceUrl);
  const pivot = normalizedDate || normalizedSource;
  if (!normalizedHome || !normalizedAway || !pivot) return undefined;
  return `${normalizedHome}|${normalizedAway}|${pivot}`;
}

function deriveMatchKey(match: MatchItem): string | undefined {
  const normalizedHome = normalizeKeyValue(match.homeTeam);
  const normalizedAway = normalizeKeyValue(match.awayTeam);
  const normalizedDate = normalizeKeyValue(match.dateTimeUtc ?? match.dateTimeLocal);
  const normalizedSource = normalizeKeyValue(match.sourceUrl);
  const pivot = normalizedDate || normalizedSource;
  if (!normalizedHome || !normalizedAway || !pivot) return undefined;
  return `${normalizedHome}|${normalizedAway}|${pivot}`;
}

function loadExistingMatchKeys() {
  try {
    if (!fs.existsSync(CSV_OUTPUT_PATH)) return;
    const fileContents = fs.readFileSync(CSV_OUTPUT_PATH, 'utf8');
    const rows = fileContents.split(/\r?\n/);

    for (const row of rows) {
      if (!row.trim()) continue;
      if (!row.includes(',')) continue;
      if (row.startsWith('HomeTeam,')) continue;

      const columns = row.split(',');
      if (columns.length < 7) continue;

      const homeTeam = stripSurroundingQuotes(columns[0]);
      const awayTeam = stripSurroundingQuotes(columns[1]);
      let localDateTimeValue = '';
      let utcDateTimeValue = '';
      let sourceUrlValue = '';

      if (columns.length >= 8) {
        const matchDate = stripSurroundingQuotes(columns[2]);
        const matchTime = stripSurroundingQuotes(columns[3]);
        localDateTimeValue = [matchDate, matchTime].filter(Boolean).join(' ').trim();
        utcDateTimeValue = stripSurroundingQuotes(columns[4]);
        sourceUrlValue = stripSurroundingQuotes(columns[7]);
      } else {
        localDateTimeValue = stripSurroundingQuotes(columns[2]);
        utcDateTimeValue = stripSurroundingQuotes(columns[3]);
        sourceUrlValue = stripSurroundingQuotes(columns[6]);
      }

      const deduplicationKey = buildMatchKeyFromRawValues(
        homeTeam,
        awayTeam,
        localDateTimeValue,
        utcDateTimeValue,
        sourceUrlValue
      );

      if (deduplicationKey) existingMatchKeys.add(deduplicationKey);
    }
  } catch (error) {
    console.error('Failed to bootstrap CSV dedupe cache:', error);
  }
}

function getLocalizedDateAndTime(match: MatchItem) {
  const candidateIso = match.dateTimeLocal ?? match.dateTimeUtc;
  if (!candidateIso) return {} as { matchDate?: string; matchTime?: string };

  let dateTimeCandidate = DateTime.fromISO(candidateIso, { setZone: true });
  if (!dateTimeCandidate.isValid) {
    dateTimeCandidate = DateTime.fromISO(candidateIso, { zone: 'utc' });
  }
  if (!dateTimeCandidate.isValid) return {} as { matchDate?: string; matchTime?: string };

  const localDateTime = dateTimeCandidate.setZone('America/Sao_Paulo');
  return {
    matchDate: localDateTime.toFormat('dd/LL/yyyy'),
    matchTime: localDateTime.toFormat('HH:mm')
  };
}

function formatWatchProviders(list?: MatchItem['whereToWatch']) {
  if (!list?.length) return '';
  
  const providerNames = list
    .map(item => item?.provider?.trim())
    .filter((provider): provider is string => Boolean(provider));
  if (!providerNames.length) return '';
  const uniqueProviders = Array.from(new Set(providerNames));
  return uniqueProviders.join('|');
}

function mapMatchToCsvRecord(match: MatchItem): CsvRecord {
  const { matchDate = '', matchTime = '' } = getLocalizedDateAndTime(match);

  return {
    homeTeam: match.homeTeam ?? '',
    awayTeam: match.awayTeam ?? '',
    matchDate,
    matchTime,
    dateTimeUtc: match.dateTimeUtc ?? '',
    competition: match.competition ?? '',
    whereToWatch: formatWatchProviders(match.whereToWatch),
    sourceUrl: match.sourceUrl
  };
}

loadExistingMatchKeys();

export async function appendMatchesToCsv(matches: MatchItem[]) {
  if (!matches.length) return;

  const matchesToAppend: MatchItem[] = [];

  for (const match of matches) {
    const deduplicationKey = deriveMatchKey(match);
    if (!deduplicationKey) continue;
    if (existingMatchKeys.has(deduplicationKey)) continue;
    existingMatchKeys.add(deduplicationKey);
    matchesToAppend.push(match);
  }

  if (!matchesToAppend.length) return;

  const csvRecords = matchesToAppend.map(mapMatchToCsvRecord);

  await csvWriter.writeRecords(csvRecords);
}
