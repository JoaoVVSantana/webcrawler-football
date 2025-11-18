#!/usr/bin/env tsx

import fs from 'fs';
import path from 'path';
import { BaseAdapter } from '../adapters/baseAdapter';

class PageTypeClassifier extends BaseAdapter {
  domain = '';
  whitelistPatterns: RegExp[] = [];
  
  extract() {
    return {};
  }
}

async function updateDocumentsWithPageTypes() {
  const documentsPath = path.join(process.cwd(), 'result', 'documents.jsonl');
  const backupPath = path.join(process.cwd(), 'result', 'documents.jsonl.backup');
  
  if (!fs.existsSync(documentsPath)) {
    console.log('❌ Arquivo documents.jsonl não encontrado');
    return;
  }
  
  fs.copyFileSync(documentsPath, backupPath);
  console.log('✅ Backup criado em documents.jsonl.backup');
  
  const classifier = new PageTypeClassifier();
  const content = fs.readFileSync(documentsPath, 'utf8');
  const lines = content.trim().split('\n');
  
  let updated = 0;
  let total = 0;
  
  const updatedLines: string[] = [];
  
  for (const line of lines) {
    if (!line.trim()) continue;
    
    try {
      const doc = JSON.parse(line);
      total++;
      
      if (!doc.pageType) {
        doc.pageType = classifier.classify(doc.url);
        updated++;
      }
      
      updatedLines.push(JSON.stringify(doc));
    } catch (error) {
      console.log(`❌ Erro ao processar linha: ${error}`);
      updatedLines.push(line); 
    }
  }
  
  fs.writeFileSync(documentsPath, updatedLines.join('\n') + '\n');
  
  console.log(`✅ Processamento concluído:`);
  console.log(`   Total de documentos: ${total}`);
  console.log(`   Documentos atualizados: ${updated}`);
  console.log(`   Documentos já tinham pageType: ${total - updated}`);
}

updateDocumentsWithPageTypes().catch(console.error);