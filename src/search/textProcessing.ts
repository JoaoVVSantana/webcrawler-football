import natural from 'natural';
import { QUERY_SYNONYMS } from './constants';

export interface TokenizationOutput {
  tokens: string[];
  stems: string[];
}

const { PorterStemmerPt } = natural;

export function normalizeText(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function tokenizeText(text: string, minTokenLength: number): TokenizationOutput {
  const normalized = normalizeText(text);
  if (!normalized) {
    return { tokens: [], stems: [] };
  }

  const tokens = normalized
    .split(' ')
    .map(token => token.trim())
    .filter(token => token.length >= minTokenLength);

  const stems = tokens
    .map(token => PorterStemmerPt.stem(token))
    .map(stem => stem?.trim())
    .filter((stem): stem is string => Boolean(stem && stem.length >= minTokenLength));

  return { tokens, stems };
}

export function expandQueryTokens(
  tokens: string[],
  stems: string[],
  minTokenLength: number
): TokenizationOutput {
  if (!tokens.length) {
    return { tokens, stems };
  }

  const tokenSet = new Set(tokens);
  const stemSet = new Set(stems);

  for (const token of tokens) {
    const synonyms = QUERY_SYNONYMS[token];
    if (!synonyms?.length) continue;

    for (const synonym of synonyms) {
      const { tokens: synonymTokens, stems: synonymStems } = tokenizeText(synonym, minTokenLength);
      for (const synToken of synonymTokens) {
        tokenSet.add(synToken);
      }
      for (const synStem of synonymStems) {
        stemSet.add(synStem);
      }
    }
  }

  return {
    tokens: Array.from(tokenSet),
    stems: Array.from(stemSet)
  };
}
