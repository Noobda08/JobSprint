const { supabaseAdmin } = require('../../lib/_supabase.js');
const { requireAdminAuth } = require('../_admin_auth.js');

module.exports = async function handler(req, res) {
  try {
    if (req.method !== 'GET') {
      return res.status(405).json({ error: 'method_not_allowed' });
    }

    const auth = requireAdminAuth(req, res);
    if (!auth) {
      return null;
    }

    const { data: creatorUser, error: lookupError } = await supabaseAdmin
      .from('creator_users')
      .select('id, email, name, role, is_active, created_at')
      .eq('id', auth.creator_user_id)
      .maybeSingle();

    if (lookupError) {
      return res.status(500).json({
        error: 'supabase_error',
        detail: lookupError.message || String(lookupError),
      });
    }

    if (!creatorUser) {
      return res.status(404).json({ error: 'creator_user_not_found' });
    }

    return res.status(200).json({ admin: creatorUser });
  } catch (error) {
    return res.status(500).json({ error: 'server_error' });
  }
};
