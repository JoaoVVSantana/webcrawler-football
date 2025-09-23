# webcrawler-football

## Proposta do Sistema de RI
1) Problema e Motivação

Torcedores precisam saber quando e onde assistir aos jogos dos times da Série A do Brasileirão, mas essa informação costuma estar fragmentada (sites de clubes, federações, mídia esportiva, plataformas de streaming e TV). A proposta é construir um crawler vertical especializado em futebol brasileiro (Série A) para coletar e unificar dados de partidas futuras e suas transmissões em um índice pesquisável.

2) Objetivo

Coletar, normalizar e disponibilizar consultas sobre:

- Time mandante/visitante

- Adversário

- Data e horário (com fuso correto)

- Onde assistir (TV aberta/fechada, streaming, YouTube) e link quando aplicável

Consultas-alvo (exemplos):

- “Próximo jogo do Cruzeiro e onde assistir”

- “Jogos do Flamengo nesta semana em streaming”

- “Transmissões no YouTube no mês que vem”

3) Escopo e Fontes

Fontes planejadas (prioridade alta = fornecem dados mais estruturados e estáveis):

Sites oficiais dos clubes da Série A (páginas de agenda/calendário; ex.: “Próximo jogo”, “Partidas”).

Plataformas de mídia/guia de programação (p. ex. páginas “onde assistir” e grades de transmissão).

Federações/Liga (tabelas e rodadas; p. ex. CBF/Liga Forte/Brasileirão quando aplicável).

Portais esportivos (p. ex. páginas de “tabela/rodada” e “agenda de jogos”).

RSS/Sitemaps quando houver.

Nota de escala (50k+ páginas): além das páginas de partidas, o sistema coletará também notícias/artigos relacionados às rodadas e páginas de histórico (mesmo contendo metadados redundantes). Para a avaliação, contam “itens coletados”; o índice poderá armazenar tanto fixtures (dados estruturados) quanto documentos (páginas texto) para atingir a escala.

4) Arquitetura de Alto Nível (RI)

Crawler vertical (Focused Crawler) com adaptadores por fonte.

- Extrator: parser de HTML/JSON-LD/Schema.org + heurísticas para datas/horários e blocos “onde assistir”.

- Normalizador:

  - times ⇢ dicionário controlado (ID, nomes alternativos: “Atlético-MG”, “Atlético Mineiro”, “CAM”)

  - datas ⇢ UTC + America/Sao_Paulo

  - transmissões ⇢ enum {tv_aberta, tv_fechada, streaming, youtube} + provider_name + url

  - Deduplicação por (teamA, teamB, datetime, competição) com tolerância de 15 min.

- Armazenamento:

  - Banco relacional (PostgreSQL) para consistência dos jogos. Ou salvamento em CSV file -> TODO

  - Índice full-text (OpenSearch/Elasticsearch) para consultas livres (“onde assistir Flamengo domingo”). TODO

- API de consulta:

  - /matches?team=FLA&from=2025-09-19&to=2025-10-19&channel=streaming

  - /next?team=CAM

- Observabilidade: logs por página, métricas (páginas/h, taxa de erro, tempo por requisição).

5) Modelo de Dados (resumo)

tables

teams(id, name, aliases[])

matches(id, team_home_id, team_away_id, start_time_utc, start_time_tz, venue, competition, season, source_confidence)

broadcasts(id, match_id, type, provider, url, is_official)

documents(id, url, source, fetched_at, http_status, title, raw_text, lang, hash)

extraction_logs(document_id, extractor, status, details)

sources(id, domain, robots_policy, max_rps, last_crawl_at)

6) Métricas de Qualidade

Cobertura: % de jogos da Série A com registro e com canal indicado.

Precisão de data/hora: % de partidas com fuso correto (comparação cruzada entre fontes).

Completude de link: % de entradas com url quando for streaming/YouTube.

Freshness: atraso médio (minutos/horas) entre atualização na fonte e atualização no índice.

Dedup: razão entre itens únicos vs. páginas totais coletadas.

7) Aspectos Éticos e Legais

Respeitar robots.txt e Terms of Use; politeness/cota por domínio; identificação via User-Agent.

Coletar apenas informação pública; não burlar paywalls; sem login.

Citar fonte no dado normalizado (campo source + source_url); manter evidência (hash do HTML).

## Descrição do Coletor
1) Tipo do Coletor

- Crawler vertical e focado (focused crawler) com:

- Frontier orientada por prioridade (páginas de “agenda/rodada/onde assistir” > notícias > históricos).

- Política de re-visita (scheduler) baseada no horizonte de jogos (7, 15 e 30 dias) e na dinâmica da fonte:

- Fontes “rápidas” (portais/TV) revisitadas a cada 2–6h perto da rodada; clubes 6–24h.

2) Propriedades Técnicas

- Descoberta de URLs:

seeds estáticas por fonte (ex.: /agenda, /tabela, /calendario, /onde-assistir, sitemaps).

follow controlado: mesmo domínio e padrões whitelisted (regex).

- Paralelismo e Politeness:

N workers com limite por domínio (ex.: 1–2 req/s) + exponencial backoff.

Respeito a Crawl-delay quando indicado; User-Agent identificável do projeto.

- Tolerâncias (timeouts & retries):

connect_timeout: 5–8s, read_timeout: 10–15s

retry: 2 com backoff (apenas para 5xx/timeout), sem retry para 4xx exceto 429 (aguarda).

- Critérios de Parada:

Escala: coletar ≥ 50.000 páginas (somatório documents), mantendo proporção de fontes.

Profundidade: max_depth por seed (ex.: 2 para “agenda”, 1 para “onde assistir”, 3 para notícias).

Orçamento: max_pages_per_domain (ex.: 5k) e janela de tempo da coleta (ex.: 48–72h para a etapa).

- Políticas de Frontier:

PriorityQueue com score = tipo_página (agenda > onde-assistir > tabela > notícia > outros)

recência (mais recente primeiro) + previsão de utilidade (contém nomes de clubes/rodada).

- Normalização & Enriquecimento:

Resolver nomes de times via dicionário/aliases e, se necessário, fuzzy match (Levenshtein).

Timezone: parse em PT-BR, converte para America/Sao_Paulo e mantém cópia em UTC.

Transmissão: mapeia keywords (“transmit”, “onde assistir”, “Premiere”, “YouTube”, “Amazon”, “Max”, “Globoplay”, etc.) e captura href quando disponível.

- Deduplicação:

hash do corpo para documentos;

para partidas, chave canônica (home, away, start_time_utc ±15m, competição) com priorização de fonte oficial; conflitos viram alertas.

- Extração Estruturada:

Preferência por schema.org (SportsEvent, Event, BroadcastEvent) quando presente.

Em HTML “livre”: seletores específicos por adaptador (ex.: .match-card .teams, .date-time, .where-to-watch a).

- Observabilidade:

Log por fetch (URL, status, ms); por extração (campos faltantes, regra acionada).

Métricas Prometheus: pages_fetched_total, extract_errors_total, matches_upserted_total.

3) Políticas Abordadas (Design Decisions + Justificativas)

Vertical/focused: maximiza precisão para o domínio (Série A), simplificando normalização (dicionário de 20 clubes) e melhorando a qualidade do “onde assistir”.

Adaptadores por fonte: lidam com HTML heterogêneo; reduzem quebra quando o layout muda.

Priorizar páginas “agenda/rodada”: maior densidade de fixtures ⇒ melhor razão sinal/ruído.

Relacional + Full-text: garantir consistência de partidas e flexibilidade de busca natural.

Revisita baseada em calendário: transmissões podem mudar perto do jogo; aumenta a freshness.

Rate limit por domínio e respeito a robots: evita bloqueios e cumpre boas práticas/ética.

4) Critério de Escala (≥ 50 mil páginas)

- Plano para atingir a meta dentro do escopo:

20 clubes × (páginas de agenda/calendário + notícias + match reports + arquivos)

Portais (múltiplas seções de tabela/rodada/notícias/guia TV)

Plataformas/guia de programação (várias páginas/dia)

Histórico de anos/rodadas anteriores (arquivos estáticos contam como itens coletados)

Com a Frontier configurada, a coleta massiva de documentos é paralela à extração de fixtures (que são poucos por semana). Assim, garantimos quantidade (avaliação) e qualidade (dados alvo).

5) Tolerâncias e Resiliência

Falhas transitórias: backoff + retry controlado; fallback de extrator (xpath secundário).

Mudança de layout: validação por testes de contrato de cada adaptador; flag “degradação” por fonte.

Conflitos de informação (ex.: dois canais diferentes): marcar source_confidence e manter ambas as versões com carimbo de fonte e horário; regra de escolha “oficial > portal”.

6) Segurança e Conformidade

Sem credenciais; sem scraping de conteúdo protegido.

Identificação com User-Agent do projeto; canal de contato.

Config por domínio: limites, headers e janelas de coleta.

7) Entregáveis para a Fase 1

Diagrama (crawler ⇢ extrator ⇢ normalizador ⇢ banco/índice ⇢ API/queries).

Amostra de 50–200 páginas coletadas com logs (para demonstrar politeness e extração).

Dataset inicial de partidas futuras (JSON/CSV) com team_home, team_away, datetime_local, where_to_watch, link.

Métricas iniciais: páginas coletadas por fonte, taxa de extração com sucesso, exemplos de conflitos resolvidos.
## TODO de Melhorias

- Consolidar a persistência de documentos e partidas em PostgreSQL e Elasticsearch, substituindo os stubs em src/pipelines/store.ts e aplicando deduplicação no banco.
- Evoluir a Frontier para uma fila priorizada e persistente, com suporte a múltiplos workers e retomada após falhas.
- Implementar um scheduler distribuído com politeness por domínio, monitoramento (Prometheus/Grafana) e alarmes de falha.
- Padronizar os adaptadores com contratos bem definidos e testes de regressão, validando seletores e estruturas schema.org.
- Automatizar o pipeline de dados: validação, geração de CSV/JSON versionados e disponibilização via API pública.
