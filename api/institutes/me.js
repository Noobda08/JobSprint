const crypto = require('crypto');
const { supabaseAdmin } = require('../../lib/_supabase.js');
const { requireInstituteAuth } = require('../../lib/_institutes_auth.js');

function isB2BEnabled() {
  return String(process.env.ENABLE_B2B || '').toLowerCase() === 'true';
}

module.exports = async function handler(req, res) {
  if (!isB2BEnabled()) {
    return res.status(404).json({ error: 'not_available' });
  }

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

    const { data: authLookup, error: authLookupError } = await supabaseAdmin.auth.admin.getUserById(auth.user_id);
    if (authLookupError) {
      return res.status(500).json({ error: 'auth_lookup_failed', detail: authLookupError.message || String(authLookupError) });
    }

    const authUser = authLookup?.user;
    if (!authUser) {
      return res.status(404).json({ error: 'user_not_found', message: 'User not found.' });
    }

    const email = authUser.email || '';
    const name = authUser.user_metadata?.name
      || authUser.user_metadata?.full_name
      || authUser.user_metadata?.display_name
      || email
      || 'Signed-in user';

    const cacheControl = 'private, max-age=60, stale-while-revalidate=300';
    const etagSeed = [
      institution.id,
      institution.logo_url || '',
      institution.name || '',
      authUser.id,
      auth.role || '',
    ].join('|');
    const etag = `W/\"${crypto.createHash('sha1').update(etagSeed).digest('base64url')}\"`;

    res.setHeader('Cache-Control', cacheControl);
    res.setHeader('ETag', etag);

    const ifNoneMatch = req.headers['if-none-match'];
    if (typeof ifNoneMatch === 'string') {
      const requestedEtags = ifNoneMatch.split(',').map((item) => item.trim());
      if (requestedEtags.includes(etag)) {
        return res.status(304).end();
      }
    }

    return res.status(200).json({
      institution,
      user: {
        id: authUser.id,
        name,
        email,
        role: auth.role,
      },
    });
  } catch (error) {
    return res.status(500).json({ error: 'server_error', message: error?.message || 'Server error.' });
  }
};
