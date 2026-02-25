/**
 * Feedback endpoint for VaseFirma AI Assistant
 * POST /api/feedback
 */
module.exports = async (req, res) => {
  const origin = req.headers.origin || '';
  const allowedOrigins = [
    'https://vasefirma.munipolis.cz',
    'https://vasefirma-ai.vercel.app',
    'http://localhost:3000'
  ];
  const corsOrigin = allowedOrigins.includes(origin) ? origin : allowedOrigins[1];
  res.setHeader('Access-Control-Allow-Origin', corsOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { sessionId, messageId, rating } = req.body || {};

  if (!rating || !['up', 'down'].includes(rating)) {
    return res.status(400).json({ error: 'Invalid feedback' });
  }

  console.log(`[feedback] session=${String(sessionId).substring(0, 20)} rating=${rating}`);

  res.status(200).json({ success: true });
};
