import fs from 'fs';
import path from 'path';
import { DocumentRecord } from '../types';
import { getInvertedIndexBuilder, snapshotInvertedIndex } from '../indexing/invertedIndex';

const documentsFile = path.join(process.cwd(), 'result', 'documents.jsonl');
const documentsDir = path.dirname(documentsFile);

let writeStream: fs.WriteStream | null = null;
const SNAPSHOT_INTERVAL = Math.max(50, Number(process.env.INDEX_SNAPSHOT_INTERVAL ?? 500));
let documentsSinceSnapshot = 0;

function ensureStream(): fs.WriteStream {
  if (!writeStream) {
    if (!fs.existsSync(documentsDir)) {
      fs.mkdirSync(documentsDir, { recursive: true });
    }
    writeStream = fs.createWriteStream(documentsFile, { flags: 'a' });
  }
  return writeStream;
}

async function appendDocumentSummary(record: DocumentRecord) {
  const { metadata } = record;
  if (!metadata) return;

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

  await new Promise<void>((resolve, reject) => {
    ensureStream().write(`${JSON.stringify(summaryPayload)}\n`, error => {
      if (error) reject(error);
      else resolve();
    });
  });
}

export async function persistDocumentMetadata(record: DocumentRecord) {
  await appendDocumentSummary(record);
  getInvertedIndexBuilder().addDocument(record);
  documentsSinceSnapshot++;
  if (documentsSinceSnapshot >= SNAPSHOT_INTERVAL) {
    snapshotInvertedIndex();
    documentsSinceSnapshot = 0;
  }
}

export function closeDocumentStream(): Promise<void> {
  return new Promise(resolve => {
    if (!writeStream) {
      resolve();
      return;
    }
    writeStream.end(() => {
      writeStream = null;
      resolve();
    });
  });
}

//podemos ativar aqui pra logar as infos
