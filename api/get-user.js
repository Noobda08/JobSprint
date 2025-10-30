// api/get-user.js
const { supabaseAdmin } = require('./_supabase.js');

module.exports = async function handler(req, res) {
  try {
    const google_id = (req.query && req.query.google_id) ? String(req.query.google_id) : '';
    if (!google_id) return res.status(400).json({ error: 'missing google_id' });

    const baseColumns = 'token,email,name,profile_complete,phone,city,dob,role,experience,resume_url,career_story';

    const isMissingColumnError = (err) => {
      if (!err) return false;
      const message = [err.message, err.details, err.hint]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return message.includes('column') && message.includes('current_ctc');
    };

    let { data, error } = await supabaseAdmin
      .from('users')
      .select(`${baseColumns},current_ctc`)
      .eq('google_id', google_id)
      .maybeSingle();

    if (error && isMissingColumnError(error)) {
      const fallback = await supabaseAdmin
        .from('users')
        .select(baseColumns)
        .eq('google_id', google_id)
        .maybeSingle();

      if (fallback.error) return res.status(500).json({ error: 'server_error' });

      data = fallback.data;
      error = null;
    }

    if (error) return res.status(500).json({ error: 'server_error' });
    if (!data) return res.status(404).json({ found: false });

    const responsePayload = { found: true, ...data };

    if (!responsePayload.current_ctc) {
      const story = responsePayload.career_story;
      if (story && typeof story === 'object' && story.current_ctc) {
        responsePayload.current_ctc = story.current_ctc;
      }
    }

    return res.status(200).json(responsePayload);
  } catch (e) {
    return res.status(500).json({ error: 'server_error' });
  }
};
