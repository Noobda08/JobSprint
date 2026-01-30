const bcrypt = require('bcryptjs');
const { supabaseAdmin } = require('../_supabase.js');
const { requireAdminAuth } = require('../_admin_auth.js');

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

function ensureSuperAdmin(auth, res) {
  if (auth.role !== 'super_admin') {
    res.status(403).json({ error: 'forbidden' });
    return false;
  }
  return true;
}

module.exports = async function handler(req, res) {
  const auth = requireAdminAuth(req, res);
  if (!auth) {
    return null;
  }

  if (!ensureSuperAdmin(auth, res)) {
    return null;
  }

  if (req.method === 'GET') {
    const { data, error } = await supabaseAdmin
      .from('creator_users')
      .select('id, email, name, role, is_active, created_at')
      .order('created_at', { ascending: false });

    if (error) {
      return res.status(500).json({ error: 'supabase_error', detail: error.message });
    }

    return res.status(200).json({ creators: data || [] });
  }

  if (req.method === 'POST') {
    const body = normalizeBody(req.body);
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const role = typeof body.role === 'string' ? body.role : 'admin';
    const password = typeof body.password === 'string' ? body.password : '';

    if (!email || !password) {
      return res.status(400).json({ error: 'missing_fields' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const { data, error } = await supabaseAdmin
      .from('creator_users')
      .upsert(
        {
          email,
          name: name || null,
          role,
          password_hash: passwordHash,
          is_active: true,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'email' }
      )
      .select('id, email, name, role, is_active')
      .maybeSingle();

    if (error) {
      return res.status(500).json({ error: 'supabase_error', detail: error.message });
    }

    return res.status(201).json({ creator: data });
  }

  if (req.method === 'PATCH') {
    const body = normalizeBody(req.body);
    const creatorUserId = typeof body.creator_user_id === 'string' ? body.creator_user_id : '';
    const isActive = typeof body.is_active === 'boolean' ? body.is_active : null;
    const password = typeof body.password === 'string' ? body.password : '';

    if (!creatorUserId) {
      return res.status(400).json({ error: 'missing_creator_user_id' });
    }

    if (typeof isActive === 'boolean') {
      const { error: updateError } = await supabaseAdmin
        .from('creator_users')
        .update({ is_active: isActive, updated_at: new Date().toISOString() })
        .eq('id', creatorUserId);

      if (updateError) {
        return res.status(500).json({ error: 'supabase_error', detail: updateError.message });
      }
    }

    if (password) {
      const passwordHash = await bcrypt.hash(password, 10);
      const { error: passwordError } = await supabaseAdmin
        .from('creator_users')
        .update({ password_hash: passwordHash, updated_at: new Date().toISOString() })
        .eq('id', creatorUserId);

      if (passwordError) {
        return res.status(500).json({ error: 'supabase_error', detail: passwordError.message });
      }
    }

    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ error: 'method_not_allowed' });
};
