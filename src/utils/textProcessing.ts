import { performance } from 'node:perf_hooks';
import natural from 'natural';
import { INDEX_CONFIG } from '../config';
import { LexicalAnalysisDetail, LexicalTopTerm } from '../types';

const { PorterStemmerPt } = natural;

const DEFAULT_STOPWORDS: string[] = [
  'a', 'ao', 'aos', 'as', 'ate', 'com', 'como', 'quando', 'quanto', 'que', 'quem', 'o', 'os', 'da', 'do', 'das', 'dos',
  'de', 'e', 'em', 'no', 'nos', 'na', 'nas', 'num', 'numa', 'numas', 'para', 'por', 'se', 'sem', 'sob', 'sobre', 'traz',
  'tras', 'pra', 'pro', 'porque', 'porquanto', 'pois', 'porem', 'mas', 'ou', 'onde', 'dos', 'das', 'dos', 'ao', 'aos',
  'lhe', 'lhes', 'me', 'te', 'seu', 'sua', 'seus', 'suas', 'este', 'esta', 'estes', 'estas', 'isso', 'isto', 'aquele',
  'aquela', 'aqueles', 'aquelas', 'depois', 'antes', 'entao', 'assim', 'tambem', 'muito', 'muita', 'muitos', 'muitas',
  'pouco', 'pouca', 'poucos', 'poucas', 'cada', 'algum', 'alguns', 'algumas', 'nenhum', 'nenhuma', 'sendo', 'era', 'eram',
  'ser', 'sao', 'foi', 'foram', 'seja', 'sejam', 'sera', 'serao', 'estou', 'esta', 'estamos', 'estao', 'estava', 'estavam',
  'estiveram', 'houve', 'haviam', 'havia', 'ter', 'tem', 'tendo', 'tinha', 'tinham', 'tambem', 'entretanto', 'todavia',
  'portanto', 'assim', 'agora', 'ainda', 'ja', 'mesmo', 'durante', 'apenas', 'sempre', 'nunca', 'nada', 'ninguem',
  'todo', 'toda', 'todos', 'todas', 'qualquer', 'quaisquer', 'que', 'pois', 'porque', 'portanto', 'logo', 'pois', 'para',
  'quando', 'quanto', 'quase', 'talvez', 'primeiro', 'segundo', 'terceiro', 'aqui', 'ai', 'ali', 'la', 'onde', 'dali',
  'deste', 'dessa', 'desses', 'dessas', 'disto', 'disso', 'daquele', 'daquela', 'daqueles', 'daquelas', 'esteja', 'estejam',
  'estive', 'estivemos', 'estiver', 'estiverem', 'fui', 'fomos', 'for', 'forem', 'sera', 'serao', 'serei', 'seremos',
  'serem', 'terei', 'teremos', 'teriam', 'teremos', 'tivessem', 'tivesse', 'tivemos', 'tiver', 'tiverem', 'vai', 'vao',
  'vaiam', 'vamos', 'voces', 'eles', 'elas', 'eu', 'tu', 'ele', 'ela', 'nos', 'vos', 'deles', 'delas', 'mesma', 'mesmo',
  'mesmos', 'mesmas', 'aquilo', 'aquilo', 'dentro', 'fora', 'algun', 'alguma', 'alguns', 'algumas', 'sendo', 'ficou',
  'ficaram', 'ficar', 'ficara', 'ficarao', 'ficariam', 'ficasse', 'ficassem', 'outro', 'outros', 'outra', 'outras',
  'apos', 'via', 'viaja', 'vez', 'vezes', 'contra', 'entre', 'depois', 'so', 'ja', 'bem', 'mal', 'ha', 'havera',
  'haverao'
];

const STOPWORDS = new Set(DEFAULT_STOPWORDS);

function removeDiacritics(input: string): string {
  return input.normalize('NFD').replace(/\p{Diacritic}/gu, '');
}

function normalizeToken(token: string): string {
  return removeDiacritics(token.toLowerCase());
}

function tokenize(text: string): string[] {
  const normalized = removeDiacritics(text.toLowerCase());
  return normalized
    .split(/[^a-z0-9]+/u)
    .map(token => token.trim())
    .filter(token => token.length >= INDEX_CONFIG.minTokenLength);
}

function computeTopTerms(frequencyMap: Map<string, number>, limit: number): LexicalTopTerm[] {
  const sorted = Array.from(frequencyMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit);
  const total = Array.from(frequencyMap.values()).reduce((sum, value) => sum + value, 0) || 1;
  return sorted.map(([term, frequency]) => ({
    term,
    frequency,
    weight: Number((frequency / total).toFixed(6))
  }));
}

export function analyzeAndNormalizeText(text: string): LexicalAnalysisDetail {
  const start = performance.now();
  const trimmed = text.trim();
  if (!trimmed) {
    return {
      tokens: [],
      stemmedTokens: [],
      frequencyByToken: {},
      tokenCount: 0,
      uniqueTokenCount: 0,
      stopwordCount: 0,
      averageTokenLength: 0,
      lexicalDensity: 0,
      topTerms: [],
      processingMs: 0
    };
  }

  const allTokens = tokenize(trimmed);
  const filteredTokens: string[] = [];
  let stopwordCounter = 0;

  for (const candidateToken of allTokens) {
    const normalized = normalizeToken(candidateToken);
    if (!normalized || STOPWORDS.has(normalized)) {
      stopwordCounter++;
      continue;
    }
    filteredTokens.push(normalized);
  }

  const frequencyMap = new Map<string, number>();
  const stemFrequency = new Map<string, number>();
  const stemmedTokens: string[] = [];

  for (const token of filteredTokens) {
    frequencyMap.set(token, (frequencyMap.get(token) ?? 0) + 1);
    const stem = PorterStemmerPt.stem(token);
    stemmedTokens.push(stem);
    stemFrequency.set(stem, (stemFrequency.get(stem) ?? 0) + 1);
  }

  const tokenCount = filteredTokens.length;
  const uniqueTokenCount = frequencyMap.size;
  const averageTokenLength =
    tokenCount === 0
      ? 0
      : filteredTokens.reduce((sum, value) => sum + value.length, 0) / tokenCount;

  const lexicalDensity =
    tokenCount + stopwordCounter === 0 ? 0 : Number((tokenCount / (tokenCount + stopwordCounter)).toFixed(6));

  const topTerms = computeTopTerms(frequencyMap, INDEX_CONFIG.topTermsLimit);
  const processingMs = Number((performance.now() - start).toFixed(3));

  return {
    tokens: filteredTokens,
    stemmedTokens,
    frequencyByToken: Object.fromEntries(stemFrequency.entries()),
    tokenCount,
    uniqueTokenCount,
    stopwordCount: stopwordCounter,
    averageTokenLength: Number(averageTokenLength.toFixed(4)),
    lexicalDensity,
    topTerms,
    processingMs
  };
}
