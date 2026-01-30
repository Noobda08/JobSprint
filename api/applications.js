const { supabaseAdmin } = require('../lib/_supabase.js');
const { findUserFromRequest } = require('../lib/_users.js');

function normalizeBody(body) {
  if (typeof body === 'string') {
    try { return JSON.parse(body || '{}'); } catch (_) { return {}; }
  }
  return body || {};
}

function mapApplicationPayload(input = {}, userId) {
  const status = input.status || 'research';
  return {
    id: input.id,
    user_id: userId,
    company: input.company || 'Unknown Company',
    role: input.role || 'Job Application',
    link: input.link || input.job_link || '',
    status,
    notes: input.notes || '',
    job_description: input.jobDescription || input.job_description || '',
    resume_version: input.resumeVersion || input.resume_version || '',
    saved_at: input.savedAt ? new Date(input.savedAt).toISOString() : (input.saved_at || null),
    applied_date: input.appliedInfo?.date || input.applied_date || null,
    source: input.appliedInfo?.source || input.source || input.platform || null,
    platform: input.platform || null,
    screening_replied: input.screeningInfo?.replied ?? input.screening_replied ?? null,
    assessment_due: input.screeningInfo?.assessmentDue || input.assessment_due || null,
    info_shared: input.screeningInfo?.infoShared || input.info_shared || null,
    interviewing_rounds: input.interviewingRounds || input.interviewing_rounds || null,
    ctc: input.offerInfo?.ctc || input.ctc || null,
    joining_date: input.offerInfo?.joiningDate || input.joining_date || null,
    offer_status: input.offerInfo?.status || input.offer_status || null,
    rejection_reason: input.rejectedInfo?.reason || input.rejection_reason || null,
    rejection_date: input.rejectedInfo?.date || input.rejection_date || null,
    questions: input.questions || null,
    fit_score: input.fit?.score ?? input.fit_score ?? null,
    fit_matches: input.fit?.matches || input.fit_matches || null,
    fit_missing: input.fit?.missing || input.fit_missing || null,
    gmail_message_id: input.gmail_message_id || null,
  };
}

async function handleGet(req, res, userId) {
  const { data, error } = await supabaseAdmin
    .from('applications')
    .select('*')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false });

  if (error) {
    return res.status(500).json({ error: 'supabase_error', detail: error.message });
  }
  return res.status(200).json({ applications: data || [] });
}

async function handleUpsert(req, res, userId) {
  const body = normalizeBody(req.body);
  const payload = mapApplicationPayload(body.application || body, userId);
  if (!payload.company || !payload.role) {
    return res.status(400).json({ error: 'missing_company_or_role' });
  }
  const { data, error } = await supabaseAdmin
    .from('applications')
    .upsert({ ...payload, user_id: userId }, { onConflict: 'id' })
    .select()
    .single();

  if (error) {
    return res.status(500).json({ error: 'supabase_error', detail: error.message });
  }
  return res.status(200).json({ application: data });
}

async function handleDelete(req, res, userId) {
  const body = normalizeBody(req.body);
  const id = body.id || req.query.id;
  if (!id) return res.status(400).json({ error: 'missing_id' });
  const { error } = await supabaseAdmin
    .from('applications')
    .delete()
    .eq('user_id', userId)
    .eq('id', id);

  if (error) {
    return res.status(500).json({ error: 'supabase_error', detail: error.message });
  }
  return res.status(200).json({ deleted: true });
}

module.exports = async function handler(req, res) {
  const { user, status, error, detail } = await findUserFromRequest(req);
  if (!user) {
    return res.status(status || 400).json({ error, detail });
  }

  if (req.method === 'GET') {
    return handleGet(req, res, user.id);
  }
  if (req.method === 'POST' || req.method === 'PUT') {
    return handleUpsert(req, res, user.id);
  }
  if (req.method === 'DELETE') {
    return handleDelete(req, res, user.id);
  }

  return res.status(405).json({ error: 'method_not_allowed' });
};
