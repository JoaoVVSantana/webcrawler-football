import fs from 'fs';
import path from 'path';

async function searchTerms() {
  console.log('🔍 BUSCA DE TERMOS NO ÍNDICE');
  console.log('='.repeat(40));
  
  const indexPath = path.join(process.cwd(), 'result', 'index', 'inverted-index.json');
  const indexData = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
  
  if (indexData.chunkIndexes && indexData.chunkIndexes.length > 0) {
    const firstChunk = indexData.chunkIndexes[0];
    const terms = Object.keys(firstChunk.terms || {});
    
    const patterns = ['flameng', 'tabel', 'corinth', 'palm', 'brasil'];
    
    patterns.forEach(pattern => {
      console.log(`\n🔍 Termos contendo "${pattern}":`);
      const matches = terms.filter(term => term.includes(pattern));
      if (matches.length === 0) {
        console.log('   Nenhum termo encontrado');
      } else {
        matches.slice(0, 10).forEach(term => {
          const termData = firstChunk.terms[term];
          console.log(`   "${term}" (${termData.docFrequency} docs)`);
        });
        if (matches.length > 10) {
          console.log(`   ... e mais ${matches.length - 10} termos`);
        }
      }
    });
    
    console.log(`\n⚽ Termos relacionados a futebol:`);
    const footballTerms = terms.filter(term => 
      term.includes('futebol') || 
      term.includes('jog') || 
      term.includes('time') || 
      term.includes('equip') ||
      term.includes('partid')
    );
    
    footballTerms.slice(0, 15).forEach(term => {
      const termData = firstChunk.terms[term];
      console.log(`   "${term}" (${termData.docFrequency} docs)`);
    });
  }
}

searchTerms().catch(console.error);