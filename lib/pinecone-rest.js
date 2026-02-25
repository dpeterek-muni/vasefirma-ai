/**
 * Pinecone REST API client — no npm dependencies
 */

let indexHost = null;

async function getHost() {
  if (indexHost) return indexHost;

  const apiKey = process.env.PINECONE_API_KEY?.trim();
  const indexName = process.env.PINECONE_INDEX_NAME || 'vasefirma-docs';

  if (!apiKey) throw new Error('PINECONE_API_KEY not configured');

  const res = await fetch(`https://api.pinecone.io/indexes/${indexName}`, {
    headers: { 'Api-Key': apiKey }
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Pinecone describe index failed: ${res.status} - ${err}`);
  }

  const data = await res.json();
  indexHost = data.host;
  console.log(`Pinecone host resolved: ${indexHost}`);
  return indexHost;
}

async function query(vector, topK = 10, namespace) {
  const host = await getHost();
  const apiKey = process.env.PINECONE_API_KEY?.trim();

  const body = { vector, topK, includeMetadata: true };
  if (namespace) body.namespace = namespace;

  const res = await fetch(`https://${host}/query`, {
    method: 'POST',
    headers: { 'Api-Key': apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Pinecone query failed: ${res.status} - ${err}`);
  }

  return res.json();
}

async function upsert(vectors, namespace) {
  const host = await getHost();
  const apiKey = process.env.PINECONE_API_KEY?.trim();

  const body = { vectors };
  if (namespace) body.namespace = namespace;

  const res = await fetch(`https://${host}/vectors/upsert`, {
    method: 'POST',
    headers: { 'Api-Key': apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Pinecone upsert failed: ${res.status} - ${err}`);
  }

  return res.json();
}

async function describeIndexStats() {
  const host = await getHost();
  const apiKey = process.env.PINECONE_API_KEY?.trim();

  const res = await fetch(`https://${host}/describe_index_stats`, {
    method: 'POST',
    headers: { 'Api-Key': apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({})
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Pinecone stats failed: ${res.status} - ${err}`);
  }

  return res.json();
}

module.exports = { getHost, query, upsert, describeIndexStats };
