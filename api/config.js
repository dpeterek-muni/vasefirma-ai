/**
 * Widget config endpoint — returns company branding/settings
 * GET /api/config
 */
module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  // Determine base URL for assets
  const proto = req.headers['x-forwarded-proto'] || 'https';
  const host = req.headers['x-forwarded-host'] || req.headers.host || 'vasefirma-ai.vercel.app';
  const baseUrl = `${proto}://${host}`;

  res.status(200).json({
    name: 'Vaše Firma',
    widgetConfig: {
      primaryColor: '#564fd8',
      logo: `${baseUrl}/logo.png`,
      logoBackground: '#ffffff',
      logoZoom: 80,
      logoPosition: 50,
      coverPhoto: `${baseUrl}/cover.jpg`,
      coverPhotoPosition: 50,
      coverPhotoZoom: 200,
      position: 'bottom-right',
      welcomeHeadline: 'Jak vám mohu pomoci?',
      welcomeMessage: 'Zeptejte se mě na cokoliv ohledně zaměstnanecké aplikace, benefitů, směrnic nebo firemních procesů.',
      quickReplies: [
        'Jaké moduly aplikace nabízí?',
        'Jak fungují benefity?',
        'Jak nahlásit podnět?',
        'Jak funguje whistleblowing?'
      ],
      autoPopupDelay: 8000,
      enablePulse: true
    }
  });
};
