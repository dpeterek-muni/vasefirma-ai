/**
 * Feedback endpoint for VaseFirma AI Assistant
 * POST /api/feedback
 */
module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { sessionId, messageId, rating, originalQuestion, originalAnswer, suggestedAnswer } = req.body || {};

  console.log(`[feedback] session=${sessionId} rating=${rating} question="${originalQuestion?.substring(0, 50)}"`);
  if (suggestedAnswer) {
    console.log(`[feedback] correction suggested: "${suggestedAnswer.substring(0, 100)}"`);
  }

  res.status(200).json({ success: true });
};
