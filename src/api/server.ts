import express from 'express';
import cors from 'cors';
import { performance } from 'node:perf_hooks';
import got from 'got';
import { SearchEngine } from '../search/searchEngine';
import { MatchInfoService } from './matchInfoService';

const app = express();
const searchEngine = new SearchEngine();
const matchInfoService = new MatchInfoService();

app.use(cors());
app.use(express.json());

app.get('/search', (req, res) => {
  try {
    const start = performance.now();
    const { q, limit, minScore } = req.query;

    if (!q || typeof q !== 'string' || !q.trim()) {
      return res.json({
        query: typeof q === 'string' ? q : '',
        total: 0,
        results: []
      });
    }

    const options = {
      limit: limit ? parseInt(limit as string, 10) : 10,
      minScore: minScore ? Number(minScore) : undefined
    };

    const results = searchEngine.search(q, options);
    const processingTime = Number((performance.now() - start).toFixed(2));

    res.json({
      query: q,
      total: results.length,
      processingTime,
      results
    });
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/status', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'Football Search API',
    timestamp: new Date().toISOString()
  });
});

app.get('/health', (_req, res) => {
  res.json({ status: 'healthy' });
});

app.get('/matches', async (req, res) => {
  const { team, limit } = req.query;

  if (!team || typeof team !== 'string' || !team.trim()) {
    return res.status(400).json({ error: 'Informe o time para consultar' });
  }

  const parsedLimit = typeof limit === 'string' ? parseInt(limit, 10) : undefined;

  try {
    const matches = await matchInfoService.getUpcomingMatches(team, parsedLimit);

    res.json({
      team,
      total: matches.length,
      matches
    });
  } catch (error) {
    console.error({ error }, 'Falha ao consultar partidas');
    res.status(500).json({ error: 'N\u00e3o foi poss\u00edvel consultar as partidas agora' });
  }
});

app.get('/matches/teams', async (_req, res) => {
  try {
    const teams = await matchInfoService.listTeams();
    res.json({ total: teams.length, teams });
  } catch (error) {
    console.error({ error }, 'Falha ao listar times');
    res.status(500).json({ error: 'N\u00e3o foi poss\u00edvel listar os times agora' });
  }
});

app.get('/logos', async (req, res) => {
  const { src } = req.query;

  if (!src || typeof src !== 'string') {
    return res.status(400).json({ error: 'Informe o parâmetro src' });
  }

  if (!/^https?:\/\//i.test(src)) {
    return res.status(400).json({ error: 'URL inválida' });
  }

  try {
    const response = await got(src, { responseType: 'buffer', timeout: { request: 8000 } });
    res.setHeader('Content-Type', response.headers['content-type'] || 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.send(response.body);
  } catch (error) {
    console.error({ src, error }, 'Falha ao proxy de logo');
    res.status(502).json({ error: 'Não foi possível carregar o logo solicitado' });
  }
});

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`Search API rodando em http://localhost:${PORT}`);
  console.log(`Teste rápido: http://localhost:${PORT}/search?q=flamengo`);
});

export default app;
