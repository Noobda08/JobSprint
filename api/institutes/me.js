const { supabaseAdmin } = require('../_supabase.js');
const { requireInstituteAuth } = require('../_institutes_auth.js');

module.exports = async function handler(req, res) {
  try {
    if (req.method !== 'GET') {
      return res.status(405).json({ error: 'method_not_allowed' });
    }

    const auth = requireInstituteAuth(req, res);
    if (!auth) {
      return null;
    }

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
  } catch (error) {
    return res.status(500).json({ error: 'server_error' });
  }
};
