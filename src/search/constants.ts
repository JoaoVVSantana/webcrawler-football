import path from 'node:path';

export const DOMAIN_BOOSTS = new Map<string, number>([
  ['ge.globo.com', 1.3],
  ['globoesporte.globo.com', 1.3],
  ['gremio.net', 1.08],
  ['cruzeiro.org', 1.08],
  ['vasco.com.br', 1.08],
  ['palmeiras.com.br', 1.15],
  ['lance.com.br', 1.08],
  ['uol.com.br', 1.08],
  ['gazetaesportiva.com', 1.12],
  ['futebolnaveia.com.br', 1.1],
  ['verdazzo.com.br', 1.06]
]);

export const FOOTBALL_KEYWORDS = new Set([
  'america',
  'athletico',
  'atletico',
  'bahia',
  'botafogo',
  'bragantino',
  'cruzeiro',
  'corinthians',
  'coritiba',
  'ceara',
  'flamengo',
  'fluminense',
  'fortaleza',
  'gremio',
  'goias',
  'inter',
  'internacional',
  'palmeiras',
  'santos',
  'sao',
  'tricolor',
  'vasco',
  'verdao'
]);

export const TITLE_COVERAGE_WEIGHT = 2;
export const URL_COVERAGE_WEIGHT = 0.7;
export const TEAM_MATCH_BOOST = 1.2;
export const TEAM_MISS_PENALTY = 0.2;

export const BM25_K1 = 1.5;
export const BM25_B = 0.75;

export const QUERY_SYNONYMS: Record<string, string[]> = {
  agenda: ['calendario', 'programacao', 'cronograma', 'proximos'],
  calendario: ['agenda', 'programacao', 'cronograma'],
  contra: ['enfrenta', 'enfrentar', 'enfrentara', 'encara', 'encarar', 'pega', 'adversario', 'rival', 'duelo', 'versus', 'vs', 'oponente', 'diante'],
  proximo: ['proximos', 'proxima', 'seguinte', 'posterior', 'agenda', 'calendario'],
  jogos: ['partidas', 'jogo', 'agenda', 'calendario'],
  jogo: ['partida', 'duelo', 'confronto', 'compromisso', 'agenda'],
  partida: ['jogo', 'partidas', 'jogos'],
  partidas: ['jogos', 'agenda'],
  proximos: ['agenda', 'calendario', 'sequencia', 'proximas'],
  semana: ['semanal', 'rodada'],
  assistir: ['transmissao', 'onde-assistir', 'streaming', 'tv', 'canal'],
  onde: ['onde-assistir', 'assistir', 'transmissao'],
  horario: ['horario', 'quando', 'hora'],
  quem: ['adversario', 'rival', 'oponente', 'time', 'clube', 'inimigo']
};

export const DEFAULT_INDEX_CANDIDATES = [
  process.env.SEARCH_INDEX_FILE,
  path.join(process.cwd(), 'inverted_index.json'),
  path.join(process.cwd(), 'inverted-index.json'),
  path.join(process.cwd(), 'result', 'inverted_index.json'),
  path.join(process.cwd(), 'result', 'inverted-index.json'),
  path.join(process.cwd(), 'result', 'index', 'inverted-index.json')
].filter(Boolean) as string[];

export const DEFAULT_DOCUMENTS_CANDIDATES = [
  process.env.SEARCH_DOCUMENTS_FILE,
  path.join(process.cwd(), 'documents.jsonl'),
  path.join(process.cwd(), 'documents.json'),
  path.join(process.cwd(), 'result', 'documents.jsonl'),
  path.join(process.cwd(), 'result', 'documents.json'),
  path.join(process.cwd(), 'result', 'documents', 'documents.jsonl')
].filter(Boolean) as string[];
