import fs from 'fs';
import path from 'path';
import { DocumentRecord, MatchItem } from '../types';
import { getInvertedIndexBuilder } from '../indexing/invertedIndex';

const documentsFile = path.join(process.cwd(), 'result', 'documents.jsonl');
const documentsDir = path.dirname(documentsFile);

async function appendDocumentSummary(record: DocumentRecord) {
  const { metadata } = record;
  if (!metadata) return;

  if (!fs.existsSync(documentsDir)) {
    fs.mkdirSync(documentsDir, { recursive: true });
  }

  const summaryPayload = {
    url: metadata.url,
    fetchedAt: metadata.fetchedAt,
    status: metadata.status,
    title: metadata.title,
    lang: metadata.lang,
    hash: metadata.rawHtmlHash,
    pageType: metadata.pageType,
    source: metadata.source,
    contentLength: metadata.contentLength,
    cleanedContentLength: metadata.cleanedContentLength,
    lexical: metadata.lexicalSummary
  };

  await fs.promises.appendFile(documentsFile, `${JSON.stringify(summaryPayload)}\n`);
}

export async function persistDocumentMetadata(record: DocumentRecord) {
  await appendDocumentSummary(record);
  getInvertedIndexBuilder().addDocument(record);
}

export function persistMatches(matches: MatchItem[]) {
  for (const match of matches) {
    //console.log({ home: match.homeTeam, away: match.awayTeam, when: match.dateTimeLocal, watch: match.whereToWatch?.[0]?.provider }, 'MATCH');
  }
}


//podemos ativar aqui pra logar as infos
