import { DocumentItem, MatchItem } from '../types';

/**
 * aqui vai ser onde gravamos no banco de dados
 * depois trocamos por Postgres/Elasticsearch/file.
 */
export async function persistDocumentMetadata(document: DocumentItem) {
  //console.log({ url: document.url, title: document.title, hash: document.rawHtmlHash.slice(0, 8) }, 'DOC');
}

export async function persistMatches(matches: MatchItem[]) {
  for (const match of matches) {
    //console.log({ home: match.homeTeam, away: match.awayTeam, when: match.dateTimeLocal, watch: match.whereToWatch?.[0]?.provider }, 'MATCH');
  }
}


//podemos ativar aqui pra logar as infos
