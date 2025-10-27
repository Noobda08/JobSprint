// /api/parse-resume.js
const formidable = require('formidable');
const fs = require('fs');
const { parseResume } = require('../resume_parser_js_robust_node'); // your big file

module.exports.config = { api: { bodyParser: false } };

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const form = formidable({ multiples: false, keepExtensions: true });

  form.parse(req, async (err, fields, files) => {
    if (err) {
      console.error('[parse-resume] Formidable error:', err);
      return res.status(400).json({ error: 'Invalid form data' });
    }

    const file = files.file;
    if (!file?.filepath) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    try {
      const result = await parseResume(file.filepath);
      fs.unlink(file.filepath, () => {});
      return res.status(200).json(result);
    } catch (e) {
      console.error('[parse-resume] Parser failed:', e);
      return res.status(500).json({ error: e.message || 'Parse failed' });
    }
  });
};
