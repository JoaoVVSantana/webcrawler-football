import type { SearchResponse } from '../types/search';

const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:3001';

interface SearchOptions {
  limit?: number;
}

export class SearchAPI {
  static async search(query: string, options?: SearchOptions): Promise<SearchResponse> {
    const params = new URLSearchParams({ q: query });

    if (options?.limit && options.limit > 0) {
      params.set('limit', options.limit.toString());
    }

    const response = await fetch(`${API_BASE}/search?${params.toString()}`);

    if (!response.ok) {
      throw new Error(`Erro na busca: ${response.status}`);
    }

    return response.json();
  }

  static async health(): Promise<boolean> {
    try {
      const response = await fetch(`${API_BASE}/health`);
      return response.ok;
    } catch {
      return false;
    }
  }
}
