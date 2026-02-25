/**
 * Health check endpoint
 * GET /api/health
 */
module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');

  const checks = {
    openai: !!process.env.OPENAI_API_KEY?.trim(),
    pinecone: !!process.env.PINECONE_API_KEY?.trim(),
    pineconeIndex: process.env.PINECONE_INDEX_NAME || 'not set'
  };

  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    checks
  });
};
