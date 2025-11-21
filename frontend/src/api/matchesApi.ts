import type { TeamMatchesResponse, TeamsResponse } from '../types/match';

const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:3001';

export class MatchesAPI {
  static async listTeams(): Promise<string[]> {
    const response = await fetch(`${API_BASE}/matches/teams`);
    if (!response.ok) {
      throw new Error('Não foi possivel carregar os times');
    }

    const payload: TeamsResponse = await response.json();
    return payload.teams ?? [];
  }

  static async getUpcoming(team: string, limit = 3): Promise<TeamMatchesResponse> {
    const params = new URLSearchParams({ team });
    if (limit > 0) {
      params.set('limit', limit.toString());
    }

    const response = await fetch(`${API_BASE}/matches?${params.toString()}`);
    if (!response.ok) {
      const text = await response.text();
      let message = text || 'Falha ao buscar partidas';
      try {
        const parsed = JSON.parse(text);
        if (parsed?.error) {
          message = parsed.error;
        }
      } catch {
        // ignore parse errors
      }
      throw new Error(message);
    }

    return response.json() as Promise<TeamMatchesResponse>;
  }

  static logoProxy(url: string): string {
    return `${API_BASE}/logos?src=${encodeURIComponent(url)}`;
  }
}
