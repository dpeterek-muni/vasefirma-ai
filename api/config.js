/**
 * Widget config endpoint — returns company branding/settings
 * GET /api/config
 */
module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  res.status(200).json({
    name: 'Vaše Firma',
    widgetConfig: {
      primaryColor: '#564fd8',
      logoBackground: '#ffffff',
      logoZoom: 65,
      logoPosition: 50,
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
