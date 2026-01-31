const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { supabaseAdmin } = require('../../lib/_supabase.js');
const { requireAdminAuth } = require('../_admin_auth.js');

const ROLE_OPTIONS = new Set(['admin', 'counselor', 'viewer']);

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

async function getAuthUser(userId) {
  const { data, error } = await supabaseAdmin.auth.admin.getUserById(userId);
  if (error) {
    throw new Error(error.message || String(error));
  }
  return data?.user || null;
}

module.exports = async function handler(req, res) {
  try {
    const auth = requireAdminAuth(req, res);
    if (!auth) {
      return null;
    }

    if (req.method === 'GET') {
      const institutionId = req.query?.institution_id;
      if (!institutionId) {
        return res.status(400).json({
          error: 'missing_institution_id',
          message: 'institution_id is required.'
        });
      }

      const { data: institutionUsers, error } = await supabaseAdmin
        .from('institution_users')
        .select('id, user_id, role, is_active, created_at')
        .eq('institution_id', institutionId)
        .order('created_at', { ascending: true });

      if (error) {
        return res.status(500).json({
          error: 'supabase_error',
          detail: error.message || String(error),
        });
      }

      const results = await Promise.all((institutionUsers || []).map(async (row) => {
        const authUser = await getAuthUser(row.user_id);
        const name = authUser?.user_metadata?.name
          || authUser?.user_metadata?.full_name
          || authUser?.user_metadata?.display_name
          || authUser?.email
          || '';

        return {
          id: row.id,
          user_id: row.user_id,
          role: row.role,
          is_active: row.is_active !== false,
          name,
          email: authUser?.email || '',
        };
      }));

      return res.status(200).json({ users: results });
    }

    if (req.method === 'POST') {
      const body = normalizeBody(req.body);
      const institutionId = typeof body.institution_id === 'string' ? body.institution_id.trim() : '';
      const name = typeof body.name === 'string' ? body.name.trim() : '';
      const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
      const role = typeof body.role === 'string' ? body.role.trim() : '';
      const password = typeof body.password === 'string' ? body.password : '';

      if (!institutionId || !email || !role || !password) {
        return res.status(400).json({
          error: 'missing_fields',
          message: 'institution_id, email, role, and password are required.'
        });
      }

      if (!ROLE_OPTIONS.has(role)) {
        return res.status(400).json({
          error: 'invalid_role',
          message: 'Role must be admin, counselor, or viewer.'
        });
      }

      const passwordHash = await bcrypt.hash(password, 10);

      let authUser = null;
      const { data: existingUser, error: existingError } = await supabaseAdmin.auth.admin.getUserByEmail(email);

      if (existingError) {
        return res.status(500).json({
          error: 'auth_lookup_failed',
          detail: existingError.message || String(existingError),
        });
      }

      if (existingUser?.user) {
        authUser = existingUser.user;
        const userMetadata = {
          ...(authUser.user_metadata || {}),
          name: name || authUser.user_metadata?.name,
          password_hash: passwordHash,
        };

        const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(authUser.id, {
          user_metadata: userMetadata,
        });

        if (updateError) {
          return res.status(500).json({
            error: 'auth_update_failed',
            detail: updateError.message || String(updateError),
          });
        }
      } else {
        const randomPassword = crypto.randomBytes(16).toString('hex');
        const { data, error: createError } = await supabaseAdmin.auth.admin.createUser({
          email,
          password: randomPassword,
          email_confirm: true,
          user_metadata: {
            name,
            password_hash: passwordHash,
          },
        });

        if (createError) {
          return res.status(500).json({
            error: 'auth_create_failed',
            detail: createError.message || String(createError),
          });
        }

        authUser = data?.user || null;
      }

      if (!authUser) {
        return res.status(500).json({ error: 'auth_user_missing' });
      }

      const { data: institutionUser, error: insertError } = await supabaseAdmin
        .from('institution_users')
        .upsert({
          institution_id: institutionId,
          user_id: authUser.id,
          role,
          is_active: true,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'institution_id,user_id' })
        .select('id, user_id, role, is_active')
        .single();

      if (insertError) {
        return res.status(500).json({
          error: 'supabase_error',
          detail: insertError.message || String(insertError),
        });
      }

      return res.status(201).json({
        user: {
          id: institutionUser.id,
          user_id: institutionUser.user_id,
          role: institutionUser.role,
          is_active: institutionUser.is_active !== false,
          name,
          email,
        }
      });
    }

    if (req.method === 'PATCH') {
      const body = normalizeBody(req.body);
      const institutionUserId = typeof body.institution_user_id === 'string' ? body.institution_user_id.trim() : '';
      const isActive = typeof body.is_active === 'boolean' ? body.is_active : null;
      const password = typeof body.password === 'string' ? body.password : '';

      if (!institutionUserId) {
        return res.status(400).json({
          error: 'missing_institution_user_id',
          message: 'institution_user_id is required.'
        });
      }

      const { data: institutionUser, error: lookupError } = await supabaseAdmin
        .from('institution_users')
        .select('id, user_id, is_active')
        .eq('id', institutionUserId)
        .maybeSingle();

      if (lookupError) {
        return res.status(500).json({
          error: 'supabase_error',
          detail: lookupError.message || String(lookupError),
        });
      }

      if (!institutionUser) {
        return res.status(404).json({ error: 'institution_user_not_found' });
      }

      const updates = {};
      if (typeof isActive === 'boolean') {
        updates.is_active = isActive;
      }

      let updatedRow = null;

      if (Object.keys(updates).length > 0) {
        updates.updated_at = new Date().toISOString();
        const { data: updated, error: updateError } = await supabaseAdmin
          .from('institution_users')
          .update(updates)
          .eq('id', institutionUserId)
          .select('id, user_id, role, is_active')
          .single();

        if (updateError) {
          return res.status(500).json({
            error: 'supabase_error',
            detail: updateError.message || String(updateError),
          });
        }

        updatedRow = updated;
      }

      if (password) {
        const passwordHash = await bcrypt.hash(password, 10);
        const authUser = await getAuthUser(institutionUser.user_id);
        const userMetadata = {
          ...(authUser?.user_metadata || {}),
          password_hash: passwordHash,
        };

        const { error: authUpdateError } = await supabaseAdmin.auth.admin.updateUserById(
          institutionUser.user_id,
          { user_metadata: userMetadata }
        );

        if (authUpdateError) {
          return res.status(500).json({
            error: 'auth_update_failed',
            detail: authUpdateError.message || String(authUpdateError),
          });
        }
      }

      if (!updatedRow && !password) {
        return res.status(400).json({
          error: 'no_updates',
          message: 'No updates provided.'
        });
      }

      return res.status(200).json({
        user: updatedRow || institutionUser,
      });
    }

    return res.status(405).json({ error: 'method_not_allowed' });
  } catch (error) {
    return res.status(500).json({ error: 'server_error' });
  }
};
