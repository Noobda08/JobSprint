// api/delete-user.js
const { supabaseAdmin } = require('../lib/_supabase.js');

function extractResumePath(url) {
  if (!url || typeof url !== 'string') return null;
  if (!url.startsWith('http')) {
    return url.replace(/^\/+/, '');
  }
  const marker = '/storage/v1/object/public/resumes/';
  const idx = url.indexOf(marker);
  if (idx === -1) return null;
  return url.slice(idx + marker.length).split('?')[0];
}

module.exports = async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'method_not_allowed' });
    }

    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body || '{}'); } catch (_) { body = {}; }
    }
    body = body || {};

    const token = typeof body.token === 'string' ? body.token : '';
    if (!token) {
      return res.status(400).json({ error: 'missing_token' });
    }

    const { data: user, error: lookupError } = await supabaseAdmin
      .from('users')
      .select('id,resume_url,google_id')
      .eq('token', token)
      .maybeSingle();

    if (lookupError) {
      console.error('delete-user lookup error:', lookupError);
      return res.status(500).json({ error: 'server_error' });
    }

    if (!user) {
      return res.status(404).json({ error: 'user_not_found' });
    }

    const { error: deleteError } = await supabaseAdmin
      .from('users')
      .delete()
      .eq('token', token);

    if (deleteError) {
      console.error('delete-user removal error:', deleteError);
      return res.status(500).json({ error: 'delete_failed' });
    }

    let resumeRemoved = false;
    const resumePath = extractResumePath(user.resume_url);
    if (resumePath) {
      try {
        const { error: storageError } = await supabaseAdmin.storage
          .from('resumes')
          .remove([resumePath]);
        if (storageError) {
          console.warn('delete-user resume removal failed:', storageError);
        } else {
          resumeRemoved = true;
        }
      } catch (storageEx) {
        console.warn('delete-user resume removal exception:', storageEx);
      }
    }

    return res.status(200).json({ success: true, resume_removed: resumeRemoved });
  } catch (e) {
    console.error('delete-user fatal:', e);
    return res.status(500).json({ error: 'server_error' });
  }
};
