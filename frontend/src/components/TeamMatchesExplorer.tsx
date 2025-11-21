import { useEffect, useMemo, useState, type ChangeEvent } from 'react';
import { MatchesAPI } from '../api/matchesApi';
import type { MatchInfo } from '../types/match';
import { getLocalTeamLogo } from '../utils/teamLogos';
import { ErrorMessage } from './ErrorMessage';
import { LoadingState } from './LoadingState';

function buildTimestamp(match: MatchInfo): number {
  if (match.kickoffISO) {
    const iso = Date.parse(match.kickoffISO);
    if (!Number.isNaN(iso)) return iso;
  }

  const [day, month, year] = (match.matchDate || '').split('/').map(part => parseInt(part, 10));
  const [hour, minute] = (match.matchTime || '').split(':').map(part => parseInt(part, 10));

  return Date.UTC(year || 0, (month || 1) - 1, day || 1, hour || 0, minute || 0);
}

type TeamLogoProps = {
  teamName: string;
  localLogo?: string;
  fallbackLogo?: string;
};

function TeamLogo({ teamName, localLogo, fallbackLogo }: TeamLogoProps) {
  const [source, setSource] = useState(localLogo ?? fallbackLogo);

  useEffect(() => {
    setSource(localLogo ?? fallbackLogo);
  }, [localLogo, fallbackLogo]);

  if (!source) return null;

  const handleError = () => {
    if (source !== fallbackLogo && fallbackLogo) {
      setSource(fallbackLogo);
    } else {
      setSource(undefined);
    }
  };

  return <img src={source} alt={`Escudo do ${teamName}`} className="team-logo" onError={handleError} />;
}

export function TeamMatchesExplorer() {
  const [teams, setTeams] = useState<string[]>([]);
  const [selectedTeam, setSelectedTeam] = useState('');
  const [matches, setMatches] = useState<MatchInfo[]>([]);
  const [isLoadingTeams, setIsLoadingTeams] = useState(false);
  const [isLoadingMatches, setIsLoadingMatches] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat('pt-BR', {
        weekday: 'long',
        day: '2-digit',
        month: 'long'
      }),
    []
  );

  const timeFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat('pt-BR', {
        hour: '2-digit',
        minute: '2-digit'
      }),
    []
  );

  useEffect(() => {
    setIsLoadingTeams(true);
    MatchesAPI.listTeams()
      .then(retrieved => setTeams(retrieved))
      .catch(() => setError('Não foi possível carregar os times no momento.'))
      .finally(() => setIsLoadingTeams(false));
  }, []);

  const handleFetchMatches = async (team: string) => {
    if (!team) {
      setMatches([]);
      return;
    }

    setIsLoadingMatches(true);
    setError(null);

    try {
      const response = await MatchesAPI.getUpcoming(team, 4);
      const sortedMatches = [...(response.matches ?? [])].sort((a, b) => buildTimestamp(a) - buildTimestamp(b));
      setMatches(sortedMatches);
    } catch (err) {
      setMatches([]);
      setError(err instanceof Error ? err.message : 'Falha ao consultar jogos');
    } finally {
      setIsLoadingMatches(false);
    }
  };

  const handleChangeTeam = (event: ChangeEvent<HTMLSelectElement>) => {
    const team = event.target.value;
    setSelectedTeam(team);
    if (team) {
      void handleFetchMatches(team);
    } else {
      setMatches([]);
    }
  };

  const formatUpdatedAt = (value: string | undefined) => {
    if (!value) return 'Atualização indisponível';
    return new Date(value).toLocaleString('pt-BR');
  };

  return (
    <section className="matches-page">
      <header className="matches-intro">
        <div>
          <p className="eyebrow">Agenda dos times</p>
          <h2>Consulte os próximos jogos por time</h2>
          <p>
            A lista é montada em tempo real a partir do Crawler, que roda sempre que você escolhe um time. Os dados são armazenados em cache.
          </p>
        </div>
      </header>

      <div className="matches-controls">
        <label htmlFor="team-select">Escolha um time</label>
        <div className="matches-actions">
          <select
            id="team-select"
            className="team-select"
            value={selectedTeam}
            onChange={handleChangeTeam}
            disabled={isLoadingTeams}
          >
            <option value="">{isLoadingTeams ? 'Carregando times...' : 'Selecione'}</option>
            {teams.map(team => (
              <option key={team} value={team}>
                {team}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="refresh-button"
            disabled={!selectedTeam || isLoadingMatches}
            onClick={() => handleFetchMatches(selectedTeam)}
          >
            {isLoadingMatches ? 'Atualizando...' : 'Recarregar'}
          </button>
        </div>
      </div>

      {error && <ErrorMessage message={error} />}

      {isLoadingMatches ? (
        <div className="matches-progress">
          <LoadingState />
          <p>Consultando fontes confiáveis...</p>
        </div>
      ) : matches.length === 0 ? (
        <div className="matches-placeholder">
          <p>Selecione um time para ver os próximos confrontos e onde assistir.</p>
          <small>Os dados são embasados na coleta do Crawler e conferidos na hora em sites oficiais.</small>
        </div>
      ) : (
        <div className="match-grid">
          {matches.map(match => {
            const kickoffDate = match.kickoffISO ? new Date(match.kickoffISO) : undefined;
            const formattedDate = kickoffDate ? dateFormatter.format(kickoffDate) : match.matchDate;
            const formattedTime = kickoffDate ? timeFormatter.format(kickoffDate) : match.matchTime;
            const updatedAt = formatUpdatedAt(match.fetchedAt);
            const broadcasterEntries = (
              match.broadcastersDetailed?.length
                ? match.broadcastersDetailed
                : match.broadcasters.map(name => ({ name }))
            ) as Array<{ name: string; logo?: string }>;

            const proxyLogo = (url?: string) => (url ? MatchesAPI.logoProxy(url) : undefined);
            const homeLocalLogo = getLocalTeamLogo(match.homeTeam);
            const awayLocalLogo = getLocalTeamLogo(match.awayTeam);
            const homeFallbackLogo = proxyLogo(match.homeTeamLogo);
            const awayFallbackLogo = proxyLogo(match.awayTeamLogo);
            const broadcasters = broadcasterEntries.map(entry => ({
              name: entry.name,
              logo: proxyLogo(entry.logo)
            }));

            const locationSegments = [
              match.locationStadium,
              [match.locationCity, match.locationState].filter(Boolean).join(' - ')
            ]
              .filter((segment): segment is string => Boolean(segment && segment.trim().length > 0))
              .map(segment => segment.trim());

            const locationDescription =
              locationSegments.length > 0 ? locationSegments.join(' • ') : 'Local não informado';

            return (
              <article key={`${match.homeTeam}-${match.awayTeam}-${match.kickoffISO ?? match.matchDate}`} className="match-card">
                <header className="match-header">
                  <div className="match-header-line">
                    <div className="match-competition">{match.competition}</div>
                    <div className="team-row">
                      <div className="team-info">
                        <TeamLogo teamName={match.homeTeam} localLogo={homeLocalLogo} fallbackLogo={homeFallbackLogo} />
                        <span>{match.homeTeam}</span>
                      </div>
                      <span className="team-vs">vs</span>
                      <div className="team-info">
                        <TeamLogo teamName={match.awayTeam} localLogo={awayLocalLogo} fallbackLogo={awayFallbackLogo} />
                        <span>{match.awayTeam}</span>
                      </div>
                    </div>
                    <div className="match-datetime">
                      {formattedDate} · {formattedTime}
                    </div>
                  </div>
                </header>

                <div className="match-details">
                  <div className="match-detail">
                    <span className="match-detail-label">Local do jogo</span>
                    <span className="match-detail-value">{locationDescription}</span>
                  </div>
                  <div className="match-detail">
                    <span className="match-detail-label">Transmissão</span>
                    {broadcasters.length > 0 ? (
                      <div className="match-detail-value broadcaster-value">
                        <ul className="broadcaster-list">
                          {broadcasters.map(entry => (
                            <li key={entry.name} className="broadcaster-item">
                              {entry.logo && <img src={entry.logo} alt={`Logo de ${entry.name}`} className="broadcaster-logo" />}
                              <span>{entry.name}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : (
                      <span className="match-detail-value">Não informado</span>
                    )}
                  </div>
                  <div className="match-detail">
                    <span className="match-detail-label">Fonte</span>
                    <a className="match-detail-value match-detail-link" href={match.sourceUrl} target="_blank" rel="noreferrer">
                      Abrir detalhes
                    </a>
                  </div>
                  <div className="match-detail">
                    <span className="match-detail-label">Atualizado em</span>
                    <span className="match-detail-value">{updatedAt}</span>
                  </div>
                </div>

                {match.sourceHeadline && (
                  <div className="match-source">
                    <strong>{match.sourceHeadline}</strong>
                    {match.sourceSummary && <p>{match.sourceSummary}</p>}
                  </div>
                )}

                {match.fetchError && <p className="match-source-error">{match.fetchError}</p>}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
