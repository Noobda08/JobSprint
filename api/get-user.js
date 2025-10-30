// api/get-user.js
const { supabaseAdmin } = require('./_supabase.js');

module.exports = async function handler(req, res) {
  try {
    const google_id = (req.query && req.query.google_id) ? String(req.query.google_id) : '';
    if (!google_id) return res.status(400).json({ error: 'missing google_id' });

    const { data, error } = await supabaseAdmin
      .from('users')
      .select('token,email,name,profile_complete,phone,city,dob,role,experience,resume_url,career_story')
      .eq('google_id', google_id)
      .maybeSingle();

    if (error) return res.status(500).json({ error: 'server_error' });
    if (!data) return res.status(404).json({ found: false });

    const { career_story: rawStory, ...rest } = data;

    const normalizeStory = (value) => {
      if (!value) return null;
      if (typeof value === 'object') {
        if (Array.isArray(value)) return { items: value };
        return { ...value };
      }
      if (typeof value === 'string') {
        const trimmed = value.trim();
        if (!trimmed) return null;
        try {
          const parsed = JSON.parse(trimmed);
          if (parsed && typeof parsed === 'object') return parsed;
        } catch (_) {
          /* ignore parse errors */
        }
        return { narrative: trimmed };
      }
      return null;
    };

    const story = normalizeStory(rawStory);

    const extractCurrentCtc = (storyData) => {
      if (!storyData || typeof storyData !== 'object') return undefined;

      const direct = storyData.current_ctc ?? storyData.currentCTC;
      if (direct !== undefined && direct !== null && direct !== '') {
        return direct;
      }

      const comp = storyData.compensation;
      if (comp && typeof comp === 'object') {
        const candidates = [
          comp.current,
          comp.current_ctc,
          comp.currentCTC,
          comp.current_salary,
          comp.currentSalary,
        ];

        for (const candidate of candidates) {
          if (candidate !== undefined && candidate !== null && candidate !== '') {
            return candidate;
          }
        }
      }

      return undefined;
    };

    const currentCtc = extractCurrentCtc(story);

    const payload = { found: true, ...rest, career_story: story };
    if (currentCtc !== undefined) {
      payload.current_ctc = currentCtc;
    }

    return res.status(200).json(payload);
  } catch (e) {
    return res.status(500).json({ error: 'server_error' });
  }
};
