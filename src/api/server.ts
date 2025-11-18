import express from 'express';
import cors from 'cors';
import { SearchEngine } from '../search/searchEngine';

const app = express();
const searchEngine = new SearchEngine();

app.use(cors());
app.use(express.json());

app.get('/search', (req, res) => {
  try {
    const { q, limit, pageTypes } = req.query;
    
    if (!q || typeof q !== 'string') {
      return res.status(400).json({ error: 'Query parameter "q" is required' });
    }
    
    const options = {
      limit: limit ? parseInt(limit as string) : 10,
      pageTypes: pageTypes ? [pageTypes as string] : undefined
    };
    
    const results = searchEngine.search(q, options);
    
    res.json({
      query: q,
      total: results.length,
      results
    });
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/status', (req, res) => {
  res.json({ 
    status: 'ok', 
    service: 'Football Search API',
    timestamp: new Date().toISOString()
  });
});

app.get('/health', (req, res) => {
  res.json({ status: 'healthy' });
});

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`🚀 Search API rodando em http://localhost:${PORT}`);
  console.log(`📍 Teste: http://localhost:${PORT}/search?q=flamengo`);
});

export default app;