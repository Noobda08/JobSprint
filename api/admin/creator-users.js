const bcrypt = require('bcryptjs');
const { supabaseAdmin } = require('../../lib/_supabase.js');
const { requireAdminAuth } = require('../_admin_auth.js');

const ROLE_OPTIONS = new Set(['super_admin', 'admin']);

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

function requireSuperAdmin(auth, res) {
  if (auth.role !== 'super_admin') {
    res.status(403).json({ error: 'forbidden', message: 'Super admin access required.' });
    return false;
  }
  return true;
}

module.exports = async function handler(req, res) {
  try {
    const auth = requireAdminAuth(req, res);
    if (!auth) {
      return null;
    }

    if (!requireSuperAdmin(auth, res)) {
      return null;
    }

    if (req.method === 'GET') {
      const { data, error } = await supabaseAdmin
        .from('creator_users')
        .select('id, email, name, role, is_active, created_at')
        .order('created_at', { ascending: false });

      if (error) {
        return res.status(500).json({
          error: 'supabase_error',
          detail: error.message || String(error),
        });
      }

      return res.status(200).json({ users: data || [] });
    }

    if (req.method === 'POST') {
      const body = normalizeBody(req.body);
      const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
      const name = typeof body.name === 'string' ? body.name.trim() : '';
      const role = typeof body.role === 'string' ? body.role.trim() : 'admin';
      const password = typeof body.password === 'string' ? body.password : '';

      if (!email || !password) {
        return res.status(400).json({
          error: 'missing_fields',
          message: 'Email and password are required.'
        });
      }

      if (!ROLE_OPTIONS.has(role)) {
        return res.status(400).json({
          error: 'invalid_role',
          message: 'Role must be super_admin or admin.'
        });
      }

      const passwordHash = await bcrypt.hash(password, 10);

      const { data, error } = await supabaseAdmin
        .from('creator_users')
        .upsert({
          email,
          name: name || null,
          role,
          password_hash: passwordHash,
          is_active: true,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'email' })
        .select('id, email, name, role, is_active, created_at')
        .single();

      if (error) {
        return res.status(500).json({
          error: 'supabase_error',
          detail: error.message || String(error),
        });
      }

      return res.status(201).json({ user: data });
    }

    if (req.method === 'PATCH') {
      const body = normalizeBody(req.body);
      const creatorUserId = typeof body.creator_user_id === 'string' ? body.creator_user_id.trim() : '';
      const isActive = typeof body.is_active === 'boolean' ? body.is_active : null;
      const password = typeof body.password === 'string' ? body.password : '';

      if (!creatorUserId) {
        return res.status(400).json({
          error: 'missing_creator_user_id',
          message: 'creator_user_id is required.'
        });
      }

      const updates = {};
      if (typeof isActive === 'boolean') {
        updates.is_active = isActive;
      }

      if (Object.keys(updates).length > 0) {
        updates.updated_at = new Date().toISOString();
      }

      if (password) {
        updates.password_hash = await bcrypt.hash(password, 10);
        updates.updated_at = new Date().toISOString();
      }

      if (Object.keys(updates).length === 0) {
        return res.status(400).json({
          error: 'no_updates',
          message: 'No updates provided.'
        });
      }

      const { data, error } = await supabaseAdmin
        .from('creator_users')
        .update(updates)
        .eq('id', creatorUserId)
        .select('id, email, name, role, is_active, created_at')
        .single();

      if (error) {
        return res.status(500).json({
          error: 'supabase_error',
          detail: error.message || String(error),
        });
      }

      return res.status(200).json({ user: data });
    }

    return res.status(405).json({ error: 'method_not_allowed' });
  } catch (error) {
    return res.status(500).json({ error: 'server_error' });
  }
};
