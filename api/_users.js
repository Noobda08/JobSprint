const { supabaseAdmin } = require('./_supabase.js');

async function findUserFromRequest(req) {
  const token = (req.query && req.query.token) ? String(req.query.token) : undefined;
  const googleId = (req.query && req.query.google_id) ? String(req.query.google_id) : undefined;

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body || '{}'); } catch (_) { body = {}; }
  }
  if (body && typeof body === 'object') {
    if (!token && body.token) req.query.token = String(body.token);
    if (!googleId && body.google_id) req.query.google_id = String(body.google_id);
  }

  const tokenToUse = req.query.token || (body && body.token);
  const googleToUse = req.query.google_id || (body && body.google_id);
  if (!tokenToUse && !googleToUse) {
    return { status: 400, error: 'missing_token_or_google_id' };
  }

  const { data, error } = await supabaseAdmin
    .from('users')
    .select('id, email, name, google_id, token')
    .or([
      tokenToUse ? `token.eq.${tokenToUse}` : '',
      googleToUse ? `google_id.eq.${googleToUse}` : ''
    ].filter(Boolean).join(','))
    .maybeSingle();

  if (error) {
    return { status: 500, error: 'supabase_error', detail: error.message };
  }
  if (!data) {
    return { status: 404, error: 'user_not_found' };
  }
  return { user: data };
}

module.exports = { findUserFromRequest };
