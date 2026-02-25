/**
 * Ingest Excel data into Pinecone for VaseFirma AI Assistant
 * Usage: node scripts/ingest-excel.js
 */
require('dotenv').config();
const XLSX = require('xlsx');
const path = require('path');

const EXCEL_PATH = process.argv[2] || path.join('C:', 'Users', 'Daniel', 'Downloads', 'Data pro Benchmark.xlsx');
const PINECONE_INDEX = process.env.PINECONE_INDEX_NAME || 'vasefirma-docs';
const BATCH_SIZE = 50;

async function getEmbedding(text) {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) throw new Error('OPENAI_API_KEY not set');

  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      input: text.substring(0, 8000),
      model: 'text-embedding-3-small'
    })
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`OpenAI error: ${response.status} - ${err}`);
  }

  const data = await response.json();
  return data.data[0].embedding;
}

async function getPineconeHost() {
  const apiKey = process.env.PINECONE_API_KEY?.trim();
  const res = await fetch(`https://api.pinecone.io/indexes/${PINECONE_INDEX}`, {
    headers: { 'Api-Key': apiKey }
  });
  if (!res.ok) throw new Error(`Pinecone error: ${res.status}`);
  const data = await res.json();
  return data.host;
}

async function upsertVectors(host, vectors) {
  const apiKey = process.env.PINECONE_API_KEY?.trim();
  const res = await fetch(`https://${host}/vectors/upsert`, {
    method: 'POST',
    headers: { 'Api-Key': apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ vectors })
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Pinecone upsert error: ${res.status} - ${err}`);
  }
  return res.json();
}

function sanitizeId(str) {
  return str
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .substring(0, 200);
}

function processExcelToChunks(filePath) {
  console.log(`Reading: ${filePath}`);
  const workbook = XLSX.readFile(filePath);
  const chunks = [];

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

    console.log(`\nSheet: ${sheetName} (${data.length} rows)`);

    // Strategy 1: Process rows with meaningful content as individual chunks
    let currentSection = '';
    let sectionContent = [];

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const cells = row.filter(c => c !== null && c !== undefined && String(c).trim() !== '');

      if (cells.length === 0) {
        // Empty row = section break
        if (sectionContent.length > 0) {
          const text = sectionContent.join('\n');
          if (text.length > 30) {
            chunks.push({
              id: sanitizeId(`vasefirma_${sheetName}_section_${chunks.length}`),
              text: text,
              source: `${sheetName}${currentSection ? ' - ' + currentSection : ''}`,
              sheet: sheetName
            });
          }
          sectionContent = [];
        }
        continue;
      }

      // Check if this is a section header (single cell or bold-like)
      if (cells.length === 1 && String(cells[0]).length < 100) {
        if (sectionContent.length > 0) {
          const text = sectionContent.join('\n');
          if (text.length > 30) {
            chunks.push({
              id: sanitizeId(`vasefirma_${sheetName}_section_${chunks.length}`),
              text: text,
              source: `${sheetName}${currentSection ? ' - ' + currentSection : ''}`,
              sheet: sheetName
            });
          }
          sectionContent = [];
        }
        currentSection = String(cells[0]).trim();
        sectionContent.push(`## ${currentSection}`);
        continue;
      }

      // Regular data row
      const rowText = cells.map(c => String(c).trim()).filter(Boolean).join(' | ');
      if (rowText.length > 10) {
        sectionContent.push(rowText);
      }

      // If section gets too long, split it
      if (sectionContent.join('\n').length > 1500) {
        const text = sectionContent.join('\n');
        chunks.push({
          id: sanitizeId(`vasefirma_${sheetName}_section_${chunks.length}`),
          text: text,
          source: `${sheetName}${currentSection ? ' - ' + currentSection : ''}`,
          sheet: sheetName
        });
        sectionContent = currentSection ? [`## ${currentSection} (pokracovani)`] : [];
      }
    }

    // Don't forget the last section
    if (sectionContent.length > 0) {
      const text = sectionContent.join('\n');
      if (text.length > 30) {
        chunks.push({
          id: sanitizeId(`vasefirma_${sheetName}_section_${chunks.length}`),
          text: text,
          source: `${sheetName}${currentSection ? ' - ' + currentSection : ''}`,
          sheet: sheetName
        });
      }
    }
  }

  // Strategy 2: Also create per-module chunks from the CORP sheets
  for (const sheetName of workbook.SheetNames) {
    if (!sheetName.toLowerCase().includes('corp') && !sheetName.toLowerCase().includes('modul')) continue;

    const sheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const moduleName = String(row[0] || '').trim();
      const moduleType = String(row[1] || '').trim();
      const moduleDesc = String(row[2] || '').trim();

      if (moduleName && moduleDesc && moduleName.length > 2) {
        const text = `Modul: ${moduleName}\nTyp: ${moduleType}\nPopis: ${moduleDesc}`;
        chunks.push({
          id: sanitizeId(`vasefirma_module_${moduleName}`),
          text: text,
          source: `Moduly aplikace - ${moduleName}`,
          sheet: sheetName
        });
      }
    }
  }

  return chunks;
}

async function main() {
  console.log('=== VaseFirma Data Ingestion ===\n');

  // Process Excel
  const chunks = processExcelToChunks(EXCEL_PATH);
  console.log(`\nTotal chunks to process: ${chunks.length}`);

  // Get Pinecone host
  console.log('\nConnecting to Pinecone...');
  const host = await getPineconeHost();
  console.log(`Host: ${host}`);

  // Generate embeddings and upsert
  let totalUpserted = 0;
  let batch = [];

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];

    try {
      console.log(`[${i + 1}/${chunks.length}] Embedding: ${chunk.source.substring(0, 60)}...`);
      const embedding = await getEmbedding(chunk.text);

      batch.push({
        id: chunk.id,
        values: embedding,
        metadata: {
          text: chunk.text,
          source: chunk.source,
          sheet: chunk.sheet,
          company: 'vasefirma'
        }
      });

      // Upsert in batches
      if (batch.length >= BATCH_SIZE || i === chunks.length - 1) {
        console.log(`  Upserting batch of ${batch.length} vectors...`);
        await upsertVectors(host, batch);
        totalUpserted += batch.length;
        batch = [];
      }

      // Rate limit: 200ms between embeddings
      await new Promise(r => setTimeout(r, 200));
    } catch (error) {
      console.error(`  Error processing chunk ${i}: ${error.message}`);
    }
  }

  console.log(`\n=== Done! ===`);
  console.log(`Total vectors upserted: ${totalUpserted}`);
  console.log(`Pinecone index: ${PINECONE_INDEX}`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
