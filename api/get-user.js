// api/get-user.js
const { supabaseAdmin } = require('./_supabase.js');

module.exports = async function handler(req, res) {
  try {
    const google_id = (req.query && req.query.google_id) ? String(req.query.google_id) : '';
    if (!google_id) return res.status(400).json({ error: 'missing google_id' });

    const { data, error } = await supabaseAdmin
      .from('users')
      .select('token,email,name,profile_complete,phone,city,dob,role,experience,current_ctc,resume_url,career_story')
      .eq('google_id', google_id)
      .maybeSingle();

    if (error) return res.status(500).json({ error: 'server_error' });
    if (!data) return res.status(404).json({ found: false });

    return res.status(200).json({ found: true, ...data });
  } catch (e) {
    return res.status(500).json({ error: 'server_error' });
  }
};
