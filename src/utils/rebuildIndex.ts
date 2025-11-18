import fs from 'fs';
import path from 'path';
import { getInvertedIndexBuilder, finalizeInvertedIndex } from '../indexing/invertedIndex';
import { analyzeAndNormalizeText } from '../utils/textProcessing';
import { DocumentRecord } from '../types';

async function rebuildIndex() {
  console.log('🔄 Reconstruindo índice invertido...');
  
  try {
    const documentsPath = path.join(process.cwd(), 'result', 'documents.jsonl');
    
    if (!fs.existsSync(documentsPath)) {
      console.log('❌ Arquivo documents.jsonl não encontrado');
      return;
    }
    
    const content = fs.readFileSync(documentsPath, 'utf8');
    const lines = content.trim().split('\n');
    
    console.log(`📄 Processando ${lines.length} documentos...`);
    
    const builder = getInvertedIndexBuilder();
    let processed = 0;
    
    for (const line of lines) {
      if (!line.trim()) continue;
      
      try {
        const doc = JSON.parse(line);
        
        const record: DocumentRecord = {
          metadata: {
            url: doc.url,
            fetchedAt: doc.fetchedAt,
            status: doc.status,
            title: doc.title,
            lang: doc.lang,
            pageType: doc.pageType,
            source: doc.source,
            rawHtmlHash: doc.hash,
            contentLength: doc.contentLength,
            cleanedContentLength: doc.cleanedContentLength,
            lexicalSummary: doc.lexical
          }
        };
        
        if (doc.lexical && doc.lexical.topTerms) {
          const title = doc.title || '';
          if (title) {
            const analysis = analyzeAndNormalizeText(title);
            record.lexical = analysis;
          } else {
            const tokens = doc.lexical.topTerms.map((term: any) => term.term);
            record.lexical = {
              ...doc.lexical,
              tokens,
              stemmedTokens: tokens, 
              frequencyByToken: doc.lexical.topTerms.reduce((acc: any, term: any) => {
                acc[term.term] = term.frequency;
                return acc;
              }, {})
            };
          }
        }
        
        builder.addDocument(record);
        processed++;
        
        if (processed % 100 === 0) {
          console.log(`   Processados: ${processed}/${lines.length}`);
        }
      } catch (error) {
        console.log(`❌ Erro ao processar documento: ${error}`);
      }
    }
    
    console.log(`✅ ${processed} documentos processados. Finalizando índice...`);
    finalizeInvertedIndex();
    console.log('✅ Índice reconstruído com sucesso!');
    
  } catch (error) {
    console.error('❌ Erro ao reconstruir índice:', error);
  }
}

rebuildIndex();