// api/create-user.js
const crypto = require('crypto');
const { supabaseAdmin } = require('./_supabase.js');

module.exports = async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'method_not_allowed' });
    }

    // raw or parsed
    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch (e) {}
    }
    body = body || {};

    const {
      google_id, email, name,
      role, applications_goal_per_day, resume_url,
      career_story = {}, payment_id = '',
      plan_start, plan_end
    } = body;

    if (!google_id || !email) {
      return res.status(400).json({ error: 'missing google_id_or_email', got: body });
    }

    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return res.status(500).json({ error: 'missing_env_vars' });
    }

    const token = crypto.randomUUID();

    const { error } = await supabaseAdmin.from('users').insert({
      google_id,
      email,
      name: name || null,
      token,
      role: role || null,
      goal_per_day: Number(applications_goal_per_day || 4),
      resume_url: resume_url || null,
      career_story,
      payment_id: payment_id || null,
      plan_start: plan_start || null,
      plan_end: plan_end || null
    });

    if (error) {
      console.error('Supabase insert error:', error);
      return res.status(500).json({ error: 'supabase_insert_failed', detail: error.message || error });
    }

    return res.status(200).json({
      success: true,
      token,
      redirect_url: `/workspace.html?u=${encodeURIComponent(token)}`
    });
  } catch (e) {
    console.error('create-user fatal:', e);
    return res.status(500).json({ error: 'server_error', detail: String(e) });
  }
};
