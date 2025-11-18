const API_BASE = 'http://localhost:3001';

export class SearchAPI {
  static async search(query, filters = {}) {
    const params = new URLSearchParams({
      q: query,
      ...(filters.pageType && { pageType: filters.pageType }),
      ...(filters.limit && { limit: filters.limit.toString() }),
      ...(filters.minScore && { minScore: filters.minScore.toString() })
    });

    const response = await fetch(`${API_BASE}/search?${params}`);
    
    if (!response.ok) {
      throw new Error(`Erro na busca: ${response.status}`);
    }

    return response.json();
  }

  static async health() {
    try {
      const response = await fetch(`${API_BASE}/health`);
      return response.ok;
    } catch {
      return false;
    }
  }
}