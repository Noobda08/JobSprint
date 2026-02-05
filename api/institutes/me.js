const { supabaseAdmin } = require('../../lib/_supabase.js');
const { requireInstituteAuth } = require('../../lib/_institutes_auth.js');

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
      .select('id, slug, name, logo_url, primary_color, secondary_color')
      .eq('id', auth.institution_id)
      .maybeSingle();

    if (institutionError) {
      return res.status(500).json({ error: 'supabase_error', detail: institutionError.message || String(institutionError) });
    }

    if (!institution) {
      return res.status(404).json({ error: 'institution_not_found', message: 'Institution not found.' });
    }

    return res.status(200).json({ institution });
  } catch (error) {
    return res.status(500).json({ error: 'server_error', message: error?.message || 'Server error.' });
  }
};
