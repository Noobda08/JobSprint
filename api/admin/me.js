const { supabaseAdmin } = require('../_supabase.js');
const { requireAdminAuth } = require('../_admin_auth.js');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  const auth = requireAdminAuth(req, res);
  if (!auth) {
    return null;
  }

  const { data: creator, error } = await supabaseAdmin
    .from('creator_users')
    .select('id, email, name, role, is_active')
    .eq('id', auth.creator_user_id)
    .maybeSingle();

  if (error) {
    return res.status(500).json({ error: 'supabase_error', detail: error.message });
  }

  if (!creator) {
    return res.status(404).json({ error: 'creator_not_found' });
  }

  return res.status(200).json({ admin: creator });
};
