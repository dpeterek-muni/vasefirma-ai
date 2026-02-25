/**
 * Health check endpoint
 * GET /api/health
 */
module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
};
