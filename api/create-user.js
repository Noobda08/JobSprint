// api/create-user.js
const crypto = require('crypto');
const Razorpay = require('razorpay');
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
      phone, city, dob, experience, current_ctc,

      // story & plan
      career_story, plan_start, plan_end,

      // flow flags
      profile_complete, onboarding_step,

      // allow initial contact creation without payment
      allow_payment_pending
    } = body;

    if (!google_id || !email) {
      return res.status(400).json({ error: 'missing_google_id_or_email' });
    }
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return res.status(500).json({ error: 'missing_env_vars' });
    }

    // Build a PATCH object with only provided fields (avoid clobbering)
    const paymentId = typeof payment_id === 'string' ? payment_id.trim() : payment_id;

    const allowPaymentPending = !!allow_payment_pending;

    const patch = { google_id };
    if (email !== undefined) patch.email = email;
    if (name !== undefined) patch.name = name;
    if (payment_id !== undefined) patch.payment_id = paymentId;

    if (role !== undefined) patch.role = role;
    if (applications_goal_per_day !== undefined) patch.goal_per_day = Number(applications_goal_per_day);
    if (resume_url !== undefined) patch.resume_url = resume_url;

    if (phone !== undefined) patch.phone = phone;
    if (city !== undefined) patch.city = city;
    if (dob !== undefined && dob) patch.dob = dob;          // expect "YYYY-MM-DD"
    if (experience !== undefined) patch.experience = Number(experience);

    const normalizeCareerStory = (input) => {
      if (input === undefined) return undefined;
      if (input && typeof input === 'object' && !Array.isArray(input)) {
        return { ...input };
      }
      if (input === null || input === '') return {};
      return { narrative: String(input) };
    };

    let normalizedStory = normalizeCareerStory(career_story);
    if (current_ctc !== undefined) {
      const ctcValue = typeof current_ctc === 'string' ? current_ctc.trim() : current_ctc;
      if (ctcValue !== undefined && ctcValue !== null && ctcValue !== '') {
        patch.current_ctc = ctcValue;
        if (!normalizedStory) normalizedStory = {};
        if (typeof normalizedStory === 'object' && normalizedStory !== null) {
          normalizedStory.current_ctc = ctcValue;
          const existingComp = normalizedStory.compensation;
          if (!existingComp || typeof existingComp !== 'object') {
            normalizedStory.compensation = { current: ctcValue };
          } else {
            normalizedStory.compensation = { ...existingComp, current: ctcValue };
          }
        }
      }
    }

    if (normalizedStory && typeof normalizedStory === 'object') {
      const keys = Object.keys(normalizedStory);
      if (keys.length > 0) {
        patch.career_story = normalizedStory;
      }
    }
    if (plan_start !== undefined) patch.plan_start = plan_start; // "YYYY-MM-DD"
    if (plan_end !== undefined) patch.plan_end = plan_end;       // "YYYY-MM-DD"

    if (profile_complete !== undefined) patch.profile_complete = !!profile_complete;
    if (onboarding_step !== undefined) patch.onboarding_step = onboarding_step;

    const { data: existingUser, error: lookupError } = await supabaseAdmin
      .from('users')
      .select('token, payment_id, profile_complete')
      .eq('google_id', google_id)
      .maybeSingle();

    if (lookupError) {
      console.error('supabase lookup error:', lookupError);
      return res.status(500).json({
        error: 'supabase_lookup_failed',
        detail: lookupError.message || String(lookupError)
      });
    }

    const isNewUser = !existingUser;

    if (isNewUser && !paymentId) {
      if (!allowPaymentPending) {
        return res.status(402).json({
          error: 'payment_required',
          message: 'Payment is required before creating a new account.'
        });
      }

      // ensure the shell account stays locked until payment completes
      patch.profile_complete = false;
    }

    if (paymentId) {
      if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
        return res.status(500).json({
          error: 'missing_razorpay_env',
          message: 'Payment verification is unavailable. Please contact support.'
        });
      }

      try {
        const razorpay = new Razorpay({
          key_id: process.env.RAZORPAY_KEY_ID,
          key_secret: process.env.RAZORPAY_KEY_SECRET,
        });

        const payment = await razorpay.payments.fetch(paymentId);
        if (!payment || payment.status !== 'captured') {
          return res.status(402).json({
            error: 'payment_not_captured',
            message: 'We could not confirm your payment. Please complete the checkout process first.'
          });
        }
      } catch (err) {
        console.error('razorpay verification error:', err);
        return res.status(402).json({
          error: 'payment_verification_failed',
          message: 'Payment could not be verified. Please complete the payment and try again.'
        });
      }
    }

    const hasIncomingPayment = !!(paymentId && paymentId.length);
    const hasExistingPayment = !!(existingUser?.payment_id && String(existingUser.payment_id).trim().length);
    const nextProfileComplete =
      patch.profile_complete !== undefined ? patch.profile_complete : existingUser?.profile_complete;

    if (nextProfileComplete && !hasIncomingPayment && !hasExistingPayment) {
      return res.status(402).json({
        error: 'payment_required',
        message: 'Payment is required before completing onboarding.'
      });
    }

    const userToken = existingUser?.token || crypto.randomUUID();
    patch.token = userToken;

    patch.updated_at = new Date().toISOString();

    // Create or update the record keyed by google_id
    const performUpsert = () =>
      supabaseAdmin
        .from('users')
        .upsert(patch, { onConflict: 'google_id' });

    let { error } = await performUpsert();
    if (error && patch.current_ctc !== undefined) {
      const message = error.message || error.details || '';
      if (typeof message === 'string' && /current_ctc/i.test(message)) {
        console.warn('users.current_ctc column missing; storing value in career_story only');
        delete patch.current_ctc;
        ({ error } = await performUpsert());
      }
    }

    if (error) {
      console.error('supabase upsert error:', error);
      return res.status(500).json({ error: 'supabase_upsert_failed', detail: error.message || String(error) });
    }

    const shouldShowReadiness = isNewUser && !!nextProfileComplete;
    const redirectUrl = shouldShowReadiness
      ? `/sprint-readiness.html?u=${encodeURIComponent(userToken)}`
      : `/workspace.html?u=${encodeURIComponent(userToken)}`;

    return res.status(200).json({
      success: true,
      token: userToken,
      redirect_url: redirectUrl
    });
  } catch (e) {
    console.error('create-user fatal:', e);
    return res.status(500).json({ error: 'server_error', detail: String(e) });
  }
};
