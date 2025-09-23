import { DateTime } from 'luxon';

export function parsePtBrDateTimeToIso(datetimeText: string, defaultYear?: number) {
  const normalizedText = datetimeText
    .replace(/\s+/g, ' ')
    .replace(/de\s+/gi, ' ')
    .trim();

  const candidateIsoInputs = [normalizedText, normalizedText.replace(/\s+(?=\d{1,2}:\d{2})/, 'T')];
  let parsedDate: DateTime | undefined;

  for (const candidate of candidateIsoInputs) 
  {
    const parsed = DateTime.fromISO(candidate, { zone: 'America/Sao_Paulo', locale: 'pt-BR' });
    if (parsed.isValid) 
    {
      parsedDate = parsed;
      break;
    }
  }

  if (!parsedDate) 
  {
    const numericDateMatch = normalizedText.match(/(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{4}))?(?:\s+|\s*-\s*)(\d{1,2}):(\d{2})/);
    if (numericDateMatch) 
    {
      const [, dayString, monthString, yearString, hourString, minuteString] = numericDateMatch;
      const resolvedYear = yearString ? Number(yearString) : (defaultYear ?? DateTime.now().year);
      const candidateDateTime = DateTime.fromObject(
        {
          day: Number(dayString),
          month: Number(monthString),
          year: resolvedYear,
          hour: Number(hourString),
          minute: Number(minuteString)
        },
        { zone: 'America/Sao_Paulo', locale: 'pt-BR' }
      );
      if (candidateDateTime.isValid) parsedDate = candidateDateTime;
    }
  }

  if (!parsedDate) 
  {
    const monthNameMatch = normalizedText.match(/(\d{1,2})\s+([A-Za-z??????%ua???"???????"o??]+).*?(\d{1,2}):(\d{2})/);
    if (monthNameMatch) 
    {
      const [, dayString, monthName, hourString, minuteString] = monthNameMatch;
      let candidateDateTime = DateTime.fromFormat(`${dayString} ${monthName} ${hourString}:${minuteString}`, 'd LLLL HH:mm', {
        zone: 'America/Sao_Paulo',
        locale: 'pt-BR'
      });
      if (!candidateDateTime.isValid) 
      {
        candidateDateTime = DateTime.fromFormat(
          `${dayString} ${monthName} ${defaultYear ?? DateTime.now().year} ${hourString}:${minuteString}`,
          'd LLLL yyyy HH:mm',
          { zone: 'America/Sao_Paulo', locale: 'pt-BR' }
        );
      }
      if (candidateDateTime.isValid) parsedDate = candidateDateTime;
    }
  }

  if (!parsedDate) 
  {
    const isoMatch = normalizedText.match(/(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
    if (isoMatch) 
    {
      const [, yearStr, monthStr, dayStr, hourStr, minuteStr, secondStr] = isoMatch;
      const zone = isoMatch[0].includes('Z') ? 'utc' : 'America/Sao_Paulo';
      const candidateDateTime = DateTime.fromObject(
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
      if (candidateDateTime.isValid) 
      {
        parsedDate = candidateDateTime.setZone('America/Sao_Paulo');
      }
    }
  }

  if (!parsedDate) return {};
  return { local: parsedDate.toISO() ?? undefined, utc: parsedDate.toUTC().toISO() ?? undefined };
}
