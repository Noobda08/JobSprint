const { supabaseAdmin } = require('../../lib/_supabase.js');
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

module.exports = async function handler(req, res) {
  try {
    const auth = requireAdminAuth(req, res);
    if (!auth) {
      return null;
    }

    if (req.method === 'GET') {
      const { data, error } = await supabaseAdmin
        .from('institutions')
        .select('id, name, slug, created_at, logo_url, primary_color, secondary_color')
        .order('created_at', { ascending: false });

      if (error) {
        return res.status(500).json({
          error: 'supabase_error',
          detail: error.message || String(error),
        });
      }

      return res.status(200).json({ institutions: data || [] });
    }

    if (req.method === 'POST') {
      const body = normalizeBody(req.body);
      const name = typeof body.name === 'string' ? body.name.trim() : '';
      const slug = typeof body.slug === 'string' ? body.slug.trim().toLowerCase() : '';
      const logoUrl = typeof body.logo_url === 'string' ? body.logo_url.trim() : null;
      const primaryColor = typeof body.primary_color === 'string' ? body.primary_color.trim() : null;
      const secondaryColor = typeof body.secondary_color === 'string' ? body.secondary_color.trim() : null;

      if (!name || !slug) {
        return res.status(400).json({
          error: 'missing_fields',
          message: 'Name and slug are required.'
        });
      }

      const { data, error } = await supabaseAdmin
        .from('institutions')
        .insert({
          name,
          slug,
          logo_url: logoUrl || null,
          primary_color: primaryColor || null,
          secondary_color: secondaryColor || null,
          updated_at: new Date().toISOString(),
        })
        .select('id, name, slug, created_at, logo_url, primary_color, secondary_color')
        .single();

      if (error) {
        return res.status(500).json({
          error: 'supabase_error',
          detail: error.message || String(error),
        });
      }

      return res.status(201).json({ institution: data });
    }

    return res.status(405).json({ error: 'method_not_allowed' });
  } catch (error) {
    return res.status(500).json({ error: 'server_error' });
  }
};
