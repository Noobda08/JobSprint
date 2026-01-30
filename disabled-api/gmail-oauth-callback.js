const { exchangeCodeForTokens, getProfile, registerWatch } = require('../lib/_gmail.js');
const { supabaseAdmin } = require('../lib/_supabase.js');
const { findUserFromRequest } = require('../lib/_users.js');

function decodeState(state) {
  try {
    const normalized = state.replace(/-/g, '+').replace(/_/g, '/');
    const parsed = JSON.parse(Buffer.from(normalized, 'base64').toString('utf8'));
    return parsed;
  } catch (_) {
    return {};
  }
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  const { code, state } = req.query || {};
  if (!code) return res.status(400).json({ error: 'missing_code' });
  const decoded = decodeState(state || '');
  req.query.token = decoded.token || req.query.token;
  const { user, status, error, detail } = await findUserFromRequest(req);
  if (!user) return res.status(status || 400).json({ error, detail });

  try {
    const tokens = await exchangeCodeForTokens(code);
    const accessToken = tokens.access_token;
    const refreshToken = tokens.refresh_token;
    const expiresAt = tokens.expires_in ? new Date(Date.now() + (tokens.expires_in * 1000)).toISOString() : null;

    const profile = await getProfile(accessToken);
    const gmailAddress = profile.emailAddress || '';

    const upsertPayload = {
      user_id: user.id,
      gmail_address: gmailAddress,
      access_token: accessToken,
      refresh_token: refreshToken,
      token_expires_at: expiresAt,
    };

    let watchResponse = null;
    try {
      watchResponse = await registerWatch(accessToken);
      upsertPayload.last_history_id = watchResponse.historyId;
      if (watchResponse.expiration) {
        upsertPayload.watch_expiration = new Date(Number(watchResponse.expiration)).toISOString();
      }
    } catch (err) {
      console.error('gmail watch registration failed', err);
    }

    const { error: upsertError } = await supabaseAdmin
      .from('gmail_integrations')
      .upsert(upsertPayload, { onConflict: 'user_id,gmail_address' });

    if (upsertError) {
      return res.status(500).json({ error: 'supabase_error', detail: upsertError.message });
    }

    const redirect = `/workspace.html?u=${encodeURIComponent(user.token)}&gmail=connected`;
    res.writeHead(302, { Location: redirect });
    res.end();
  } catch (err) {
    console.error('oauth callback error', err);
    res.status(500).json({ error: 'oauth_callback_failed', detail: err.message });
  }
};
