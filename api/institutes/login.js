const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { supabaseAdmin } = require('../../lib/_supabase.js');
const { requireInstituteAuth } = require('../../lib/_institutes_auth.js');

function normalizeBody(body) {
  if (typeof body === 'string') {
    try { return JSON.parse(body || '{}'); } catch (_) { return {}; }
  }
  return body || {};
}

async function handleMe(req, res) {
  const auth = requireInstituteAuth(req, res);
  if (!auth) {
    return null;
  }

  // Schema note: expects `institutions` table with `slug` (login) and branding columns.
  const { data: institution, error: institutionError } = await supabaseAdmin
    .from('institutions')
    .select('id, name, logo_url, primary_color, secondary_color')
    .eq('id', auth.institution_id)
    .maybeSingle();

  if (institutionError) {
    return res.status(500).json({
      error: 'supabase_error',
      detail: institutionError.message || String(institutionError),
    });
  }

  if (!institution) {
    return res.status(404).json({
      error: 'institution_not_found',
      message: 'Institution not found.',
    });
  }

  const { data: authLookup, error: authLookupError } = await supabaseAdmin.auth.admin.getUserById(
    auth.user_id
  );

  if (authLookupError) {
    return res.status(500).json({
      error: 'auth_lookup_failed',
      detail: authLookupError.message || String(authLookupError),
    });
  }

  const authUser = authLookup?.user;
  if (!authUser) {
    return res.status(404).json({
      error: 'user_not_found',
      message: 'User not found.',
    });
  }

  const email = authUser.email || '';
  const userName = authUser.user_metadata?.name
    || authUser.user_metadata?.full_name
    || authUser.user_metadata?.display_name
    || email;

  return res.status(200).json({
    institution: {
      id: institution.id,
      name: institution.name,
      logo_url: institution.logo_url,
      primary_color: institution.primary_color,
      secondary_color: institution.secondary_color,
      branding: {
        primary_color: institution.primary_color,
        secondary_color: institution.secondary_color,
      },
    },
    user: {
      id: authUser.id,
      name: userName,
      email,
      role: auth.role,
    },
  });
}

module.exports = async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      return await handleMe(req, res);
    }

    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'method_not_allowed' });
    }

    const body = normalizeBody(req.body);
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const password = typeof body.password === 'string' ? body.password : '';
    const institutionSlug = typeof body.institution_slug === 'string' ? body.institution_slug.trim() : '';

    if (!email || !password) {
      return res.status(400).json({
        error: 'missing_fields',
        message: 'Email and password are required.'
      });
    }

    if (!process.env.INSTITUTES_JWT_SECRET) {
      return res.status(500).json({ error: 'missing_jwt_secret' });
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

    let institution = null;
    if (institutionSlug) {
      // Schema note: expects `institutions.slug` to be unique for institute login.
      const { data: institutionRecord, error: institutionError } = await supabaseAdmin
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

      if (!institutionRecord) {
        return res.status(404).json({
          error: 'institution_not_found',
          message: 'Institution not found.'
        });
      }

      institution = institutionRecord;
    }

    // Schema note: expects `institution_users` join table keyed by institution_id + user_id.
    let institutionUser = null;
    if (institution) {
      const { data: userRecord, error: userError } = await supabaseAdmin
        .from('institution_users')
        .select('id, institution_id, role, user_id, is_active')
        .eq('institution_id', institution.id)
        .eq('user_id', authUser.id)
        .maybeSingle();

      if (userError) {
        return res.status(500).json({
          error: 'supabase_error',
          detail: userError.message || String(userError)
        });
      }

      institutionUser = userRecord;
    } else {
      const { data: userRecords, error: userError } = await supabaseAdmin
        .from('institution_users')
        .select('id, institution_id, role, user_id, is_active, created_at')
        .eq('user_id', authUser.id)
        .order('created_at', { ascending: true });

      if (userError) {
        return res.status(500).json({
          error: 'supabase_error',
          detail: userError.message || String(userError)
        });
      }

      const activeRecords = (userRecords || []).filter((row) => row.is_active !== false);
      if (activeRecords.length === 1) {
        institutionUser = activeRecords[0];
      } else if (activeRecords.length > 1) {
        return res.status(400).json({
          error: 'multiple_institutions',
          message: 'Multiple institute memberships found. Contact support to resolve.'
        });
      }
    }

    if (!institutionUser) {
      return res.status(401).json({
        error: 'membership_not_found',
        message: 'No active institute membership found for this account.'
      });
    }

    if (institutionUser.is_active === false) {
      return res.status(401).json({
        error: 'membership_inactive',
        message: 'Institute membership is inactive.'
      });
    }

    if (!institution) {
      const { data: institutionRecord, error: institutionError } = await supabaseAdmin
        .from('institutions')
        .select('id, name, logo_url, primary_color, secondary_color')
        .eq('id', institutionUser.institution_id)
        .maybeSingle();

      if (institutionError) {
        return res.status(500).json({
          error: 'supabase_error',
          detail: institutionError.message || String(institutionError)
        });
      }

      if (!institutionRecord) {
        return res.status(404).json({
          error: 'institution_not_found',
          message: 'Institution not found.'
        });
      }

      institution = institutionRecord;
    }

    const passwordHash = authUser.user_metadata?.password_hash
      || authUser.user_metadata?.passwordHash
      || authUser.app_metadata?.password_hash
      || authUser.app_metadata?.passwordHash;

    if (!passwordHash) {
      return res.status(401).json({
        error: 'password_not_initialized',
        message: 'Password has not been initialized.'
      });
    }

    const passwordMatches = await bcrypt.compare(password, passwordHash);
    if (!passwordMatches) {
      return res.status(401).json({
        error: 'password_incorrect',
        message: 'Password is incorrect.'
      });
    }

    const token = jwt.sign(
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
