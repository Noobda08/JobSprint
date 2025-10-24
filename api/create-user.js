// api/create-user.js
const crypto = require('crypto');
const { supabaseAdmin } = require('./_supabase.js');

module.exports = async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'method_not_allowed' });
    }

    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const {
      google_id, email, name,
      role, applications_goal_per_day, resume_url,
      career_story = {}, payment_id = '',
      plan_start, plan_end
    } = body || {};

    if (!google_id || !email) {
      return res.status(400).json({ error: 'missing google_id/email' });
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

    if (error) throw error;

    return res.status(200).json({
      success: true,
      token,
      redirect_url: `/workspace.html?u=${encodeURIComponent(token)}`
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'server_error' });
  }
};
