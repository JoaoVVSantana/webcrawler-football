import { DateTime } from 'luxon';

export function parsePtBrDateTimeToIso(datetimeText: string, defaultYear?: number) {
  const cleaned = datetimeText
    .replace(/\s+/g, ' ')
    .replace(/de\s+/gi, ' ')
    .trim();

  const isoCandidates = [cleaned, cleaned.replace(/\s+(?=\d{1,2}:\d{2})/, 'T')];
  let dt: DateTime | undefined;

  for (const candidate of isoCandidates) {
    const parsed = DateTime.fromISO(candidate, { zone: 'America/Sao_Paulo', locale: 'pt-BR' });
    if (parsed.isValid) {
      dt = parsed;
      break;
    }
  }

  if (!dt) {
    const m = cleaned.match(/(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{4}))?(?:\s+|\s*-\s*)(\d{1,2}):(\d{2})/);
    if (m) {
      const [, d, mo, y, hh, mm] = m;
      const year = y ? Number(y) : (defaultYear ?? DateTime.now().year);
      const candidate = DateTime.fromObject(
        { day: Number(d), month: Number(mo), year, hour: Number(hh), minute: Number(mm) },
        { zone: 'America/Sao_Paulo', locale: 'pt-BR' }
      );
      if (candidate.isValid) dt = candidate;
    }
  }

  if (!dt) {
    const m2 = cleaned.match(/(\d{1,2})\s+([A-Za-z??????%ua???"???????"o??]+).*?(\d{1,2}):(\d{2})/);
    if (m2) {
      const [, d2, monthName, hh2, mm2] = m2;
      let candidate = DateTime.fromFormat(`${d2} ${monthName} ${hh2}:${mm2}`, 'd LLLL HH:mm', {
        zone: 'America/Sao_Paulo',
        locale: 'pt-BR'
      });
      if (!candidate.isValid) {
        candidate = DateTime.fromFormat(
          `${d2} ${monthName} ${defaultYear ?? DateTime.now().year} ${hh2}:${mm2}`,
          'd LLLL yyyy HH:mm',
          { zone: 'America/Sao_Paulo', locale: 'pt-BR' }
        );
      }
      if (candidate.isValid) dt = candidate;
    }
  }

  if (!dt) {
    const isoMatch = cleaned.match(/(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
    if (isoMatch) {
      const [, yearStr, monthStr, dayStr, hourStr, minuteStr, secondStr] = isoMatch;
      const zone = isoMatch[0].includes('Z') ? 'utc' : 'America/Sao_Paulo';
      const candidate = DateTime.fromObject(
        {
          year: Number(yearStr),
          month: Number(monthStr),
          day: Number(dayStr),
          hour: hourStr ? Number(hourStr) : 0,
          minute: minuteStr ? Number(minuteStr) : 0,
          second: secondStr ? Number(secondStr) : 0
        },
        { zone, locale: 'pt-BR' }
      );
      if (candidate.isValid) {
        dt = candidate.setZone('America/Sao_Paulo');
      }
    }
  }

  if (!dt) return {};
  return { local: dt.toISO() ?? undefined, utc: dt.toUTC().toISO() ?? undefined };
}
