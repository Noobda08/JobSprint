// api/get-user-by-token.js
const { supabaseAdmin } = require('../lib/_supabase.js');
const { isB2CCoreEnabled, respondB2CCoreDisabled } = require('../lib/_feature_flags.js');

module.exports = async function handler(req, res) {
  if (!isB2CCoreEnabled()) {
    return respondB2CCoreDisabled(res);
  }
  try {
    if (req.method !== 'GET') {
      return res.status(405).json({ error: 'method_not_allowed' });
    }

    const token = (req.query && req.query.token) ? String(req.query.token) : '';
    if (!token) return res.status(400).json({ error: 'missing_token' });

    const { data, error } = await supabaseAdmin
      .from('users')
      .select('email,name,goal_per_day,google_id')
      .eq('token', token)
      .maybeSingle();

    if (error) return res.status(500).json({ error: 'server_error' });
    if (!data) return res.status(404).json({ found:false });

    return res.status(200).json({ found:true, ...data });
  } catch (e) {
    return res.status(500).json({ error: 'server_error' });
  }
};
