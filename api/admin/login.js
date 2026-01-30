const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { supabaseAdmin } = require('../_supabase.js');

function normalizeBody(body) {
  if (typeof body === 'string') {
    try {
      return JSON.parse(body || '{}');
    } catch (_) {
      return {};
    }
  }
  return body || {};
}

module.exports = async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'method_not_allowed' });
    }

    if (!process.env.ADMIN_JWT_SECRET) {
      return res.status(500).json({ error: 'missing_jwt_secret' });
    }

    const body = normalizeBody(req.body);
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const password = typeof body.password === 'string' ? body.password : '';

    if (!email || !password) {
      return res.status(400).json({ error: 'missing_credentials' });
    }

    const { data: creator, error } = await supabaseAdmin
      .from('creator_users')
      .select('id, email, name, role, password_hash, is_active')
      .eq('email', email)
      .maybeSingle();

    if (error) {
      return res.status(500).json({ error: 'supabase_error', detail: error.message });
    }

    if (!creator || !creator.is_active) {
      return res.status(401).json({ error: 'invalid_credentials' });
    }

    const passwordMatches = await bcrypt.compare(password, creator.password_hash);
    if (!passwordMatches) {
      return res.status(401).json({ error: 'invalid_credentials' });
    }

    const token = jwt.sign(
      { creator_user_id: creator.id, role: creator.role, email: creator.email },
      process.env.ADMIN_JWT_SECRET,
      { expiresIn: 60 * 60 * 24 * 7 }
    );

    return res.status(200).json({
      token,
      admin: {
        id: creator.id,
        email: creator.email,
        name: creator.name,
        role: creator.role,
        is_active: creator.is_active,
      },
    });
  } catch (error) {
    return res.status(500).json({ error: 'server_error' });
  }
};
