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

function getNameFromMetadata(user) {
  return user?.user_metadata?.name
    || user?.user_metadata?.full_name
    || user?.user_metadata?.display_name
    || null;
}

module.exports = async function handler(req, res) {
  const auth = requireAdminAuth(req, res);
  if (!auth) {
    return null;
  }

  if (req.method === 'GET') {
    const institutionId = typeof req.query?.institution_id === 'string'
      ? req.query.institution_id
      : '';

    if (!institutionId) {
      return res.status(400).json({ error: 'missing_institution_id' });
    }

    const { data: rows, error } = await supabaseAdmin
      .from('institution_users')
      .select('id, user_id, role, is_active, created_at')
      .eq('institution_id', institutionId)
      .order('created_at', { ascending: false });

    if (error) {
      return res.status(500).json({ error: 'supabase_error', detail: error.message });
    }

    const users = await Promise.all(
      (rows || []).map(async (row) => {
        const { data: authData } = await supabaseAdmin.auth.admin.getUserById(row.user_id);
        const authUser = authData?.user;
        return {
          id: row.id,
          user_id: row.user_id,
          role: row.role,
          is_active: row.is_active,
          name: getNameFromMetadata(authUser),
          email: authUser?.email || null,
        };
      })
    );

    return res.status(200).json({ users });
  }

  if (req.method === 'POST') {
    const body = normalizeBody(req.body);
    const institutionId = typeof body.institution_id === 'string' ? body.institution_id : '';
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const role = typeof body.role === 'string' ? body.role : '';
    const password = typeof body.password === 'string' ? body.password : '';

    if (!institutionId || !email || !role || !password) {
      return res.status(400).json({ error: 'missing_fields' });
    }

    let authUser = null;
    const passwordHash = await bcrypt.hash(password, 10);
    const { data: createdUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        name: name || email,
        password_hash: passwordHash,
      },
    });

    if (createError) {
      const { data: existingUser, error: lookupError } = await supabaseAdmin.auth.admin.getUserByEmail(email);
      if (lookupError || !existingUser?.user) {
        return res.status(500).json({ error: 'auth_create_failed', detail: createError.message });
      }
      authUser = existingUser.user;
      await supabaseAdmin.auth.admin.updateUserById(authUser.id, {
        user_metadata: {
          ...(authUser.user_metadata || {}),
          name: name || authUser.user_metadata?.name || authUser.email,
          password_hash: passwordHash,
        },
        password,
      });
    } else {
      authUser = createdUser.user;
    }

    const { data: mapping, error: mappingError } = await supabaseAdmin
      .from('institution_users')
      .upsert(
        {
          institution_id: institutionId,
          user_id: authUser.id,
          role,
          is_active: true,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'institution_id,user_id' }
      )
      .select('id, user_id, role, is_active')
      .maybeSingle();

    if (mappingError) {
      return res.status(500).json({ error: 'supabase_error', detail: mappingError.message });
    }

    return res.status(201).json({
      user: {
        id: mapping.id,
        user_id: mapping.user_id,
        role: mapping.role,
        is_active: mapping.is_active,
        name: name || authUser.email,
        email: authUser.email,
      },
    });
  }

  if (req.method === 'PATCH') {
    const body = normalizeBody(req.body);
    const institutionUserId = typeof body.institution_user_id === 'string' ? body.institution_user_id : '';
    const isActive = typeof body.is_active === 'boolean' ? body.is_active : null;
    const password = typeof body.password === 'string' ? body.password : '';

    if (!institutionUserId) {
      return res.status(400).json({ error: 'missing_institution_user_id' });
    }

    const { data: mapping, error: mappingError } = await supabaseAdmin
      .from('institution_users')
      .select('id, user_id, role, is_active')
      .eq('id', institutionUserId)
      .maybeSingle();

    if (mappingError) {
      return res.status(500).json({ error: 'supabase_error', detail: mappingError.message });
    }

    if (!mapping) {
      return res.status(404).json({ error: 'institution_user_not_found' });
    }

    if (typeof isActive === 'boolean') {
      const { error: updateError } = await supabaseAdmin
        .from('institution_users')
        .update({ is_active: isActive, updated_at: new Date().toISOString() })
        .eq('id', institutionUserId);

      if (updateError) {
        return res.status(500).json({ error: 'supabase_error', detail: updateError.message });
      }
    }

    if (password) {
      const passwordHash = await bcrypt.hash(password, 10);
      const { data: authData } = await supabaseAdmin.auth.admin.getUserById(mapping.user_id);
      const authUser = authData?.user;
      const userMetadata = { ...(authUser?.user_metadata || {}), password_hash: passwordHash };

      const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(mapping.user_id, {
        user_metadata: userMetadata,
        password,
      });

      if (authError) {
        return res.status(500).json({ error: 'auth_update_failed', detail: authError.message });
      }
    }

    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ error: 'method_not_allowed' });
};
