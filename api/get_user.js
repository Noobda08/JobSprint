// api/get-user.js
const { supabaseAdmin } = require('./_supabase.js');

module.exports = async function handler(req, res) {
  try {
    const { google_id } = req.query || {};
    if (!google_id) return res.status(400).json({ error: 'missing google_id' });

    const { data, error } = await supabaseAdmin
      .from('users')
      .select('token,email,name')
      .eq('google_id', google_id)
      .single();

    // error.code === 'PGRST116' means no rows
    if (error && error.code !== 'PGRST116') throw error;
    if (!data) return res.status(404).json({ found: false });

    return res.status(200).json({ found: true, ...data });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'server_error' });
  }
};
