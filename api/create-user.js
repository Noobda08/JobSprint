// api/create-user.js
const crypto = require('crypto');
const { supabaseAdmin } = require('./_supabase.js');

module.exports = async function handler(req, res) {
  try {
    if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });

    let body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const {
      google_id, email, name, payment_id,
      role, applications_goal_per_day, resume_url,
      career_story, plan_start, plan_end,
      profile_complete, onboarding_step
    } = body;

    if (!google_id || !email) return res.status(400).json({ error: 'missing google_id_or_email' });

    // Build a patch object with ONLY defined values (no accidental null overwrites)
    const patch = { google_id };
    if (email !== undefined) patch.email = email;
    if (name !== undefined) patch.name = name;
    if (payment_id !== undefined) patch.payment_id = payment_id;
    if (role !== undefined) patch.role = role;
    if (applications_goal_per_day !== undefined) patch.goal_per_day = Number(applications_goal_per_day);
    if (resume_url !== undefined) patch.resume_url = resume_url;
    if (career_story !== undefined) patch.career_story = career_story;
    if (plan_start !== undefined) patch.plan_start = plan_start;
    if (plan_end !== undefined) patch.plan_end = plan_end;
    if (profile_complete !== undefined) patch.profile_complete = !!profile_complete;
    if (onboarding_step !== undefined) patch.onboarding_step = onboarding_step;

    // always ensure token exists
    const { data: existing } = await supabaseAdmin
      .from('users')
      .select('token')
      .eq('google_id', google_id)
      .maybeSingle();

    if (!existing || !existing.token) {
      patch.token = crypto.randomUUID();
    }

    patch.updated_at = new Date().toISOString();

    const { error } = await supabaseAdmin
      .from('users')
      .upsert(patch, { onConflict: 'google_id' });

    if (error) return res.status(500).json({ error: 'supabase_upsert_failed', detail: error.message });

    const token = (existing && existing.token) ? existing.token : patch.token;
    return res.status(200).json({
      success: true,
      token,
      redirect_url: `/workspace.html?u=${encodeURIComponent(token)}`
    });
  } catch (e) {
    return res.status(500).json({ error: 'server_error', detail: String(e) });
  }
};
