const crypto = require('crypto');
const { supabaseAdmin } = require('../_supabase.js');

function normalizeBody(body) {
  if (typeof body === 'string') {
    try { return JSON.parse(body || '{}'); } catch (_) { return {}; }
  }
  return body || {};
}

function base64UrlEncode(input) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function signJwt(payload, secret, options = {}) {
  const issuedAt = Math.floor(Date.now() / 1000);
  const header = { alg: 'HS256', typ: 'JWT' };
  const exp = options.expiresIn ? issuedAt + options.expiresIn : undefined;
  const body = exp ? { ...payload, iat: issuedAt, exp } : { ...payload, iat: issuedAt };
  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(body));
  const data = `${encodedHeader}.${encodedPayload}`;
  const signature = crypto
    .createHmac('sha256', secret)
    .update(data)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
  return `${data}.${signature}`;
}

module.exports = async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'method_not_allowed' });
    }

    const body = normalizeBody(req.body);
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const password = typeof body.password === 'string' ? body.password : '';
    const institutionSlug = typeof body.institution_slug === 'string' ? body.institution_slug.trim() : '';

    if (!email || !password || !institutionSlug) {
      return res.status(400).json({
        error: 'missing_fields',
        message: 'Email, password, and institution are required.'
      });
    }

    if (!process.env.INSTITUTES_JWT_SECRET) {
      return res.status(500).json({ error: 'missing_jwt_secret' });
    }

    const { data: institution, error: institutionError } = await supabaseAdmin
      .from('institutions')
      .select('id, name, logo_url, primary_color, secondary_color')
      .eq('slug', institutionSlug)
      .maybeSingle();

    if (institutionError) {
      return res.status(500).json({
        error: 'supabase_error',
        detail: institutionError.message || String(institutionError)
      });
    }

    if (!institution) {
      return res.status(404).json({
        error: 'institution_not_found',
        message: 'Institution not found.'
      });
    }

    const { data: authLookup, error: authLookupError } = await supabaseAdmin.auth.admin.getUserByEmail(email);
    if (authLookupError) {
      return res.status(500).json({
        error: 'auth_lookup_failed',
        detail: authLookupError.message || String(authLookupError)
      });
    }

    const authUser = authLookup?.user;
    if (!authUser) {
      return res.status(401).json({
        error: 'invalid_credentials',
        message: 'Invalid email or password.'
      });
    }

    const { data: institutionUser, error: userError } = await supabaseAdmin
      .from('institution_users')
      .select('id, institution_id, role, user_id')
      .eq('institution_id', institution.id)
      .eq('user_id', authUser.id)
      .maybeSingle();

    if (userError) {
      return res.status(500).json({
        error: 'supabase_error',
        detail: userError.message || String(userError)
      });
    }

    if (!institutionUser) {
      return res.status(401).json({
        error: 'invalid_credentials',
        message: 'Invalid email or password.'
      });
    }

    const { error: authError } = await supabaseAdmin.auth.signInWithPassword({ email, password });
    if (authError) {
      return res.status(401).json({
        error: 'invalid_credentials',
        message: 'Invalid email or password.'
      });
    }

    const token = signJwt(
      {
        institution_id: institution.id,
        user_id: authUser.id,
        role: institutionUser.role,
        email,
      },
      process.env.INSTITUTES_JWT_SECRET,
      { expiresIn: 60 * 60 * 24 * 7 }
    );

    const userName = authUser.user_metadata?.name
      || authUser.user_metadata?.full_name
      || authUser.user_metadata?.display_name
      || authUser.email;

    return res.status(200).json({
      token,
      institution: {
        id: institution.id,
        name: institution.name,
        logo_url: institution.logo_url,
        primary_color: institution.primary_color,
        secondary_color: institution.secondary_color,
      },
      user: {
        id: authUser.id,
        name: userName,
        email,
        role: institutionUser.role,
      }
    });
  } catch (error) {
    return res.status(500).json({ error: 'server_error' });
  }
};
