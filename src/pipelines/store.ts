import { DocumentItem, MatchItem } from '../types';

/**
 * aqui vai ser onde gravamos no banco de dados
 * depois trocamos por Postgres/Elasticsearch/file.
 */
export async function storeDocument(doc: DocumentItem) {
  //console.log({ url: doc.url, title: doc.title, hash: doc.rawHtmlHash.slice(0, 8) }, 'DOC');
}

export async function upsertMatches(items: MatchItem[]) {
  for (const m of items) {
    //console.log({ home: m.homeTeam, away: m.awayTeam, when: m.dateTimeLocal, watch: m.whereToWatch?.[0]?.provider }, 'MATCH');
  }
}


//podemos ativar aqui pra logar as infos