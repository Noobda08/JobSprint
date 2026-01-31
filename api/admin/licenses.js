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
      const institutionId = req.query?.institution_id;
      if (!institutionId) {
        return res.status(400).json({
          error: 'missing_institution_id',
          message: 'institution_id is required.'
        });
      }

      const { data, error } = await supabaseAdmin
        .from('institution_licenses')
        .select('id, institution_id, plan, seats, valid_until, status, created_at, updated_at')
        .eq('institution_id', institutionId)
        .maybeSingle();

      if (error) {
        return res.status(500).json({
          error: 'supabase_error',
          detail: error.message || String(error),
        });
      }

      return res.status(200).json({ license: data });
    }

    if (req.method === 'POST' || req.method === 'PUT') {
      const body = normalizeBody(req.body);
      const institutionId = typeof body.institution_id === 'string' ? body.institution_id.trim() : '';
      const plan = typeof body.plan === 'string' ? body.plan.trim() : '';
      const status = typeof body.status === 'string' ? body.status.trim() : 'active';
      const seats = Number.isFinite(body.seats) ? body.seats : parseInt(body.seats, 10);
      const validUntil = typeof body.valid_until === 'string' ? body.valid_until.trim() : null;

      if (!institutionId || !plan || !Number.isFinite(seats)) {
        return res.status(400).json({
          error: 'missing_fields',
          message: 'institution_id, plan, and seats are required.'
        });
      }

      const { data, error } = await supabaseAdmin
        .from('institution_licenses')
        .upsert({
          institution_id: institutionId,
          plan,
          seats,
          valid_until: validUntil || null,
          status: status || 'active',
          updated_at: new Date().toISOString(),
        }, { onConflict: 'institution_id' })
        .select('id, institution_id, plan, seats, valid_until, status, created_at, updated_at')
        .single();

      if (error) {
        return res.status(500).json({
          error: 'supabase_error',
          detail: error.message || String(error),
        });
      }

      return res.status(200).json({ license: data });
    }

    return res.status(405).json({ error: 'method_not_allowed' });
  } catch (error) {
    return res.status(500).json({ error: 'server_error' });
  }
};
