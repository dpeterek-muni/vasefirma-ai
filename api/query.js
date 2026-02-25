/**
 * Main RAG query endpoint for VaseFirma AI Assistant
 * POST /api/query
 */
const pinecone = require('../lib/pinecone-rest');

async function getEmbedding(text) {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) throw new Error('OpenAI API key not configured');

  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      input: text,
      model: 'text-embedding-3-small'
    })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenAI Embedding error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  return data.data[0].embedding;
}

async function searchDocuments(query, topK = 10) {
  const queryEmbedding = await getEmbedding(query);
  const results = await pinecone.query(queryEmbedding, topK);
  return results.matches || [];
}

async function generateAnswer(question, documents, chatHistory) {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) throw new Error('OpenAI API key not configured');

  const context = documents
    .filter(doc => doc.score > 0.3)
    .map((doc, i) => {
      const text = doc.metadata?.text || '';
      const source = doc.metadata?.source || 'Interní dokument';
      const score = (doc.score * 100).toFixed(1);
      return `[Dokument ${i + 1} - Relevance: ${score}% - Zdroj: ${source}]\n${text}`;
    })
    .join('\n\n---\n\n');

  const systemPrompt = `Jsi AI asistent zaměstnanecké aplikace Vaše Firma od Munipolis. Odpovídáš zaměstnancům na dotazy ohledně firemní aplikace, jejích modulů, funkcí a procesů.

DŮLEŽITÉ POKYNY:
- Odpovídej POUZE na základě informací v kontextu níže
- Pokud informace není v kontextu, řekni upřímně že nevíš a navrhni kam se obrátit
- Buď konkrétní, přátelský a profesionální
- Odpovídej v češtině
- Formátuj odpovědi přehledně (odrážky, nadpisy kde je to vhodné)
- Pokud se ptají na konkrétní modul, vysvětli jeho funkce a přínosy

KONTEXT Z FIREMNÍ DOKUMENTACE:
${context || 'Žádné relevantní dokumenty nebyly nalezeny.'}`;

  const messages = [{ role: 'system', content: systemPrompt }];

  // Add chat history for context
  if (chatHistory && chatHistory.length > 0) {
    for (const msg of chatHistory.slice(-6)) {
      messages.push({
        role: msg.isUser ? 'user' : 'assistant',
        content: msg.text
      });
    }
  }

  messages.push({ role: 'user', content: question });

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages,
      temperature: 0.3,
      max_tokens: 800
    })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`GPT API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  return {
    answer: data.choices[0].message.content,
    usage: data.usage
  };
}

module.exports = async (req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { question, sessionId, chatHistory } = req.body || {};
  if (!question) return res.status(400).json({ error: 'Question required' });

  try {
    console.log(`[query] "${question}" session=${sessionId || 'anon'}`);

    // Search relevant documents
    const documents = await searchDocuments(question, 10);
    console.log(`[query] Found ${documents.length} matches, top score: ${documents[0]?.score?.toFixed(3) || 'N/A'}`);

    // Generate answer with RAG
    const { answer, usage } = await generateAnswer(question, documents, chatHistory);

    const sources = documents
      .filter(d => d.score > 0.3)
      .slice(0, 3)
      .map(d => ({
        source: d.metadata?.source || 'Interní dokument',
        score: d.score
      }));

    res.status(200).json({
      answer,
      sources,
      documentsFound: documents.length,
      topScore: documents[0]?.score || 0,
      tokensUsed: usage?.total_tokens || 0
    });
  } catch (error) {
    console.error('[query] Error:', error.message);
    res.status(500).json({
      answer: 'Omlouvám se, při zpracování dotazu došlo k chybě. Zkuste to prosím znovu.',
      error: error.message
    });
  }
};
