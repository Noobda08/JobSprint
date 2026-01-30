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

    const { data, error } = await supabaseAdmin
      .from('institution_licenses')
      .select('id, institution_id, plan, seats, valid_until, status')
      .eq('institution_id', institutionId)
      .maybeSingle();

    if (error) {
      return res.status(500).json({ error: 'supabase_error', detail: error.message });
    }

    return res.status(200).json({ license: data || null });
  }

  if (req.method === 'POST' || req.method === 'PUT') {
    const body = normalizeBody(req.body);
    const institutionId = typeof body.institution_id === 'string' ? body.institution_id : '';
    const plan = typeof body.plan === 'string' ? body.plan : '';
    const seats = Number.isFinite(body.seats) ? body.seats : Number.parseInt(body.seats, 10);
    const validUntil = typeof body.valid_until === 'string' ? body.valid_until : null;
    const status = typeof body.status === 'string' ? body.status : 'active';

    if (!institutionId || !plan) {
      return res.status(400).json({ error: 'missing_fields' });
    }

    const { data, error } = await supabaseAdmin
      .from('institution_licenses')
      .upsert(
        {
          institution_id: institutionId,
          plan,
          seats: Number.isFinite(seats) ? seats : 1,
          valid_until: validUntil || null,
          status,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'institution_id' }
      )
      .select('id, institution_id, plan, seats, valid_until, status')
      .maybeSingle();

    if (error) {
      return res.status(500).json({ error: 'supabase_error', detail: error.message });
    }

    return res.status(200).json({ license: data });
  }

  return res.status(405).json({ error: 'method_not_allowed' });
};
