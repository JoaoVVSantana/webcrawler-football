# webcrawler-football

Crawler e motor de busca voltados para páginas de futebol brasileiro (Série A). O código atual faz coleta genérica de HTML, processa texto para um índice invertido e expõe APIs de busca e de agenda oficial (ge.globo).

## Visão geral e estado atual (nov/2025)
- Crawler genérico: visita seeds e links subsequentes (HTTP/HTTPS), normaliza texto e grava metadados em `result/documents.jsonl`.
- Indexação invertida incremental durante a coleta em `result/index/inverted-index.json` (chunks configuráveis, snapshots periódicos).
- Frontier configurável (priority/bfs/dfs), deduplica URLs, respeita robots.txt e limita RPS por host via Bottleneck.
- API Express em `src/api/server.ts`: `/search`, `/matches`, `/matches/teams`, `/logos`, `/status`, `/health`. O endpoint de partidas usa apenas a agenda oficial do ge.globo (sem merge com outras fontes).
- Motor de busca BM25 em memória (`SearchEngine`) com stems PT-BR, sinônimos, boost por domínio confiável e cobertura de título/URL.
- Não há adaptadores específicos, dedup de partidas ou persistência em bancos (PostgreSQL/Elasticsearch); esses pontos seguem como TODO.

## Como rodar rápido
1. `npm install`
2. Configure `.env` com `SEEDS` (ou deixe os arquivos `seeds/*.json` serem carregados automaticamente).
3. Crawler: `npm run start` (ou `npm run dev` para watch). Controla `MAX_PAGES`, `MAX_RUNTIME_MINUTES`, `GLOBAL_MAX_CONCURRENCY`, `MAX_DEPTH`.
4. API de busca/agenda: `npm run search-api` (porta padrão 3001). Teste em `http://localhost:3001/search?q=flamengo`.
5. Frontend Vite: `npm run frontend` (usa `VITE_API_BASE`, padrão `http://localhost:3001`).
6. Reconstruir índice a partir de `result/documents.jsonl`: `npm run rebuild-index`.

## Coleta e frontier
- Seeds: vindas de `.env` (`SEEDS`), `SEEDS_FILE` ou de todos os `.json` em `seeds/`.
- Frontier: heap de prioridade por padrão; também aceita `CRAWLER_STRATEGY=dfs|bfs`. Deduplica URLs visitadas/em fila e corta hosts/paths/extensões indesejados (`src/utils/urlFilters.ts`).
- Politeness: `GLOBAL_MAX_CONCURRENCY` (default 15) workers em paralelo; `PER_DOMAIN_RPS` controla RPS por host; respeita robots.txt quando `RESPECT_ROBOTS=true`.
- Fetcher: HTTP/2 habilitado, timeouts via `REQUEST_TIMEOUT_MS`, descarta content-type não HTML e soft-404. Não há retries além do comportamento padrão do `got`.
- Parada: `MAX_PAGES` (default 60000), `MAX_RUNTIME_MINUTES` (0 = ilimitado) e `MAX_DEPTH`. Encerra quando não há tarefas na frontier.
- Persistência: cada página gera hash SHA-256, status HTTP, título, tamanho, estatísticas lexicais e é gravada em `result/documents.jsonl`; o índice é atualizado no worker thread (snapshot a cada `INDEX_SNAPSHOT_INTERVAL`, default 500 docs).

## Indexação e texto
- Limpeza lexical (`src/utils/textProcessing.ts`): remove scripts/iframes, minúsculas, sem acentos, tokens mínimos (`INDEX_MIN_TOKEN_LENGTH`, default 3), stopwords PT-BR removidas, stemming `PorterStemmerPt`.
- Dados gravados: `result/documents.jsonl` (um JSON por linha com metadados e resumo lexical) e `result/index/index-metadata.json` (estatísticas de indexação).
- Índice: `inverted-index.json` armazena vocabulário, postings `(docId, chunkId, tf)` e configuração (`INDEX_CHUNK_SIZES`, `INDEX_MAX_TOKENS`, `INDEX_GRANULARITY` informativo).
- Rebuild: `npm run rebuild-index` lê `documents.jsonl` e refaz o índice usando o pipeline de texto.

## Busca e API
- Engine (`src/search/searchEngine.ts`): normaliza consulta, expande sinônimos (`agenda/calendario`, `assistir/onde/streaming`, etc.), computa BM25 e aplica boosts de domínio confiável, cobertura em título/URL e fator de match de times (keywords em `FOOTBALL_KEYWORDS`).
- Endpoints da API (`src/api/server.ts`):
  - `GET /search?q=...&limit=&minScore=`: busca full-text em memória (inverte o índice carregado em startup).
  - `GET /matches?team=...&limit=`: agenda oficial do ge.globo para os próximos ~14 dias.
  - `GET /matches/teams`: lista de times suportados pela agenda.
  - `GET /logos?src=`: proxy simples para logos externas.
  - `GET /status` / `GET /health`: verificação rápida.
- Métricas básicas da execução do crawler ficam em `result/crawl-metrics.json`.

## Frontend
- `frontend/` (Vite/React) oferece busca e agenda por time. Espera a API em `VITE_API_BASE` (default `http://localhost:3001`). Rodar com `npm run frontend`.

## Seeds
- `seeds/serieA_2025.json`, `all_seeds.json`, `team_*` fornecem conjuntos prontos (portais, clubes, torcida, etc.). Você pode apontar para um arquivo específico via `SEEDS_FILE` ou confiar no carregamento automático de todos os `.json`.

## Limitações e itens não implementados
- Não há adaptadores/extração de partidas nem enriquecimento de transmissões; apenas metadados das páginas são salvos.
- Não existe snapshot/recover da frontier entre execuções (mencionado em versões antigas).
- Sem banco de dados ou Elasticsearch; tudo é arquivo local.
- Sem Prometheus/Grafana; apenas métricas básicas em JSON e logs no console.
- Script `npm run test-search` aponta para `src/search/testSearch.ts`, que não existe atualmente.

## Scripts úteis (package.json)
- `start` / `dev` – crawler
- `search-api` – API Express de busca/agenda
- `frontend` – frontend Vite
- `rebuild-index` – reconstrói o índice a partir do JSONL
- `lint` / `build` – utilidades de qualidade/compilação

