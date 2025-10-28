// api/create-user.js
const crypto = require('crypto');
const { supabaseAdmin } = require('./_supabase.js');

module.exports = async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'method_not_allowed' });
    }

    // Parse body (string or object)
    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body || '{}'); } catch (_) { body = {}; }
    }
    body = body || {};

    const {
      // identity / payment
      google_id, email, name, payment_id,

      // onboarding basics
      role, applications_goal_per_day, resume_url,
      phone, city, dob, experience,

      // story & plan
      career_story, plan_start, plan_end,

      // flow flags
      profile_complete, onboarding_step
    } = body;

    if (!google_id || !email) {
      return res.status(400).json({ error: 'missing_google_id_or_email' });
    }
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return res.status(500).json({ error: 'missing_env_vars' });
    }

    // Build a PATCH object with only provided fields (avoid clobbering)
    const patch = { google_id };
    if (email !== undefined) patch.email = email;
    if (name !== undefined) patch.name = name;
    if (payment_id !== undefined) patch.payment_id = payment_id;

    if (role !== undefined) patch.role = role;
    if (applications_goal_per_day !== undefined) patch.goal_per_day = Number(applications_goal_per_day);
    if (resume_url !== undefined) patch.resume_url = resume_url;

    if (phone !== undefined) patch.phone = phone;
    if (city !== undefined) patch.city = city;
    if (dob !== undefined && dob) patch.dob = dob;          // expect "YYYY-MM-DD"
    if (experience !== undefined) patch.experience = Number(experience);

    if (career_story !== undefined) patch.career_story = career_story;
    if (plan_start !== undefined) patch.plan_start = plan_start; // "YYYY-MM-DD"
    if (plan_end !== undefined) patch.plan_end = plan_end;       // "YYYY-MM-DD"

    if (profile_complete !== undefined) patch.profile_complete = !!profile_complete;
    if (onboarding_step !== undefined) patch.onboarding_step = onboarding_step;

    // Ensure a token exists for this user (reuse if present, else create)
    // Ensure a token always exist
      let userToken;
      try {
        const { data: existing } = await supabaseAdmin
          .from('users')
          .select('token')
          .eq('google_id', google_id)
          .maybeSingle();

        userToken = existing?.token || crypto.randomUUID();
    } catch (e) {
      userToken = crypto.randomUUID();
  }

// ✅ Always include token in patch
  patch.token = userToken;

    
    // let userToken = null;
    // try {
    //   const { data: existing } = await supabaseAdmin
    //     .from('users')
    //     .select('token')
    //     .eq('google_id', google_id)
    //     .maybeSingle();

    //   if (existing && existing.token) {
    //     userToken = existing.token;
    //   } else {
    //     userToken = crypto.randomUUID();
    //     patch.token = userToken;
    //   }
    // } catch (_) {
    //   // If lookup fails for any reason, still ensure we set a token
    //   userToken = userToken || crypto.randomUUID();
    //   patch.token = userToken; //modified
      
    //   //patch.token = patch.token || userToken; //old
    // }

    patch.updated_at = new Date().toISOString();

    // Create or update the record keyed by google_id
    const { error } = await supabaseAdmin
      .from('users')
      .upsert(patch, { onConflict: 'google_id' });

    if (error) {
      console.error('supabase upsert error:', error);
      return res.status(500).json({ error: 'supabase_upsert_failed', detail: error.message || String(error) });
    }

    return res.status(200).json({
      success: true,
      token: userToken,
      redirect_url: `/workspace.html?u=${encodeURIComponent(userToken)}`
    });
  } catch (e) {
    console.error('create-user fatal:', e);
    return res.status(500).json({ error: 'server_error', detail: String(e) });
  }
};
