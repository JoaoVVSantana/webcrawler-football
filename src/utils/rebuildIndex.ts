import fs from 'fs';
import path from 'path';
import { createInterface } from 'node:readline';
import { finalizeInvertedIndex, getInvertedIndexBuilder } from '../indexing/invertedIndex';
import { analyzeAndNormalizeText } from '../utils/textProcessing';
import { DocumentItem, DocumentRecord, LexicalAnalysisDetail, LexicalTopTerm } from '../types';

type LexicalSource = 'detail' | 'cleanedText' | 'topTerms';

const documentsPath = path.join(process.cwd(), 'result', 'documents.jsonl');

function hasLexicalDetail(value: unknown): value is LexicalAnalysisDetail {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<LexicalAnalysisDetail>;
  return Array.isArray(candidate.stemmedTokens) && Array.isArray(candidate.tokens);
}

function normalizeMetadata(raw: any): DocumentItem | null {
  if (!raw) return null;
  if (raw.metadata && raw.metadata.rawHtmlHash) return raw.metadata as DocumentItem;
  if (!raw.url || !raw.fetchedAt || typeof raw.status !== 'number') return null;

  const rawHash = raw.rawHtmlHash ?? raw.hash;
  if (!rawHash) return null;

  return {
    url: raw.url,
    fetchedAt: raw.fetchedAt,
    status: raw.status,
    title: raw.title,
    lang: raw.lang,
    pageType: raw.pageType,
    source: raw.source,
    rawHtmlHash: rawHash,
    contentLength: raw.contentLength,
    cleanedContentLength: raw.cleanedContentLength,
    lexicalSummary: raw.lexicalSummary ?? raw.lexical ?? raw.metadata?.lexicalSummary
  };
}

function buildPseudoTextFromTopTerms(terms: LexicalTopTerm[]): string {
  const parts: string[] = [];
  for (const term of terms) {
    const frequency = Math.max(1, Math.round(term.frequency ?? 1));
    parts.push(Array(frequency).fill(term.term).join(' '));
  }
  return parts.join(' ');
}

function resolveLexicalDetail(raw: any): { detail?: LexicalAnalysisDetail; source?: LexicalSource } {
  const lexicalCandidate = raw.lexicalDetail ?? raw.lexical ?? raw.metadata?.lexicalDetail ?? raw.metadata?.lexical;
  if (hasLexicalDetail(lexicalCandidate)) {
    return { detail: lexicalCandidate, source: 'detail' };
  }

  const cleanedText = raw.cleanedText ?? raw.metadata?.cleanedText;
  if (typeof cleanedText === 'string' && cleanedText.trim()) {
    return { detail: analyzeAndNormalizeText(cleanedText), source: 'cleanedText' };
  }

  const summary = raw.lexicalSummary ?? raw.lexical ?? raw.metadata?.lexicalSummary;
  if (summary?.topTerms?.length) {
    const pseudoText = buildPseudoTextFromTopTerms(summary.topTerms);
    if (pseudoText.trim()) {
      return { detail: analyzeAndNormalizeText(pseudoText), source: 'topTerms' };
    }
  }

  return {};
}

async function rebuildIndex(): Promise<void> {
  if (!fs.existsSync(documentsPath)) {
    console.error(`documents.jsonl não encontrado em ${documentsPath}`);
    return;
  }

  console.log('Iniciando reconstrução do índice a partir de result/documents.jsonl');
  const builder = getInvertedIndexBuilder();
  const stream = fs.createReadStream(documentsPath, 'utf8');
  const reader = createInterface({ input: stream, crlfDelay: Infinity });

  let processed = 0;
  let skipped = 0;
  let reusedLexical = 0;
  let rebuiltFromCleanedText = 0;
  let approximatedFromTopTerms = 0;

  for await (const line of reader) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    let parsed: any;
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      skipped++;
      console.warn('Linha ignorada: JSON inválido');
      continue;
    }

    const metadata = normalizeMetadata(parsed);
    if (!metadata) {
      skipped++;
      console.warn('Linha ignorada: metadados incompletos');
      continue;
    }

    const { detail, source } = resolveLexicalDetail(parsed);
    if (!detail) {
      skipped++;
      console.warn(`Documento ${metadata.url} ignorado: sem dados lexicais suficientes`);
      continue;
    }

    if (source === 'detail') reusedLexical++;
    else if (source === 'cleanedText') rebuiltFromCleanedText++;
    else if (source === 'topTerms') approximatedFromTopTerms++;

    const record: DocumentRecord = { metadata, lexical: detail };
    builder.addDocument(record);
    processed++;

    if (processed % 500 === 0) {
      console.log(`→ ${processed} documentos enfileirados para indexação...`);
    }
  }

  reader.close();

  if (!processed) {
    console.warn('Nenhum documento válido foi encontrado. Nada a indexar.');
    return;
  }

  console.log('Finalizando construção do índice invertido...');
  finalizeInvertedIndex();

  console.log(
    [
      `Documentos processados: ${processed}`,
      `Ignorados: ${skipped}`,
      `Lexical aproveitado: ${reusedLexical}`,
      `Reprocessado do texto limpo: ${rebuiltFromCleanedText}`,
      `Reconstruído via top terms: ${approximatedFromTopTerms}`
    ].join(' | ')
  );
}

rebuildIndex().catch(error => {
  console.error('Falha ao reconstruir o índice:', error);
  process.exitCode = 1;
});
