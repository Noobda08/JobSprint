const { buildOAuthUrl } = require('../lib/_gmail.js');
const { findUserFromRequest } = require('../lib/_users.js');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'method_not_allowed' });
  }
  const { user, status, error, detail } = await findUserFromRequest(req);
  if (!user) return res.status(status || 400).json({ error, detail });

  try {
    const state = Buffer.from(JSON.stringify({ token: user.token, t: Date.now() })).toString('base64url');
    const url = buildOAuthUrl(state);
    res.writeHead(302, { Location: url });
    res.end();
  } catch (err) {
    res.status(500).json({ error: 'oauth_start_failed', detail: err.message });
  }
};
