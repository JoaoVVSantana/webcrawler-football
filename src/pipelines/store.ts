import { DocumentItem, MatchItem } from '../types';
import { logger } from '../utils/logger';

/**
 * aqui vai ser onde gravamos num arquivo csv ou no banco de dados
 * por enquanto só loga.
 * depois trocamos por Postgres/Elasticsearch/file.
 */
export async function storeDocument(doc: DocumentItem) {
  logger.info({ url: doc.url, title: doc.title, hash: doc.rawHtmlHash.slice(0, 8) }, 'DOC');
}

export async function upsertMatches(items: MatchItem[]) {
  for (const m of items) {
    logger.info({ home: m.homeTeam, away: m.awayTeam, when: m.dateTimeLocal, watch: m.whereToWatch?.[0]?.provider }, 'MATCH');
  }
}
