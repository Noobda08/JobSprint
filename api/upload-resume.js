// /api/upload-resume.js
const formidable = require('formidable');
const fs = require('fs');
const path = require('path');
const { supabase } = require('./_supabase');

module.exports.config = { api: { bodyParser: false } };

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  const form = formidable({ multiples: false, keepExtensions: true, maxFileSize: 15 * 1024 * 1024 });

  form.parse(req, async (err, fields, files) => {
    if (err) {
      console.error('[upload-resume] Formidable error:', err);
      return res.status(400).json({ success: false, error: 'Invalid form data' });
    }

    const file = files.file;
    if (!file?.filepath) {
      return res.status(400).json({ success: false, error: 'No file uploaded' });
    }

    try {
      const buffer = fs.readFileSync(file.filepath);

      const orig = file.originalFilename || path.basename(file.filepath);
      const ext = (orig.split('.').pop() || 'bin').toLowerCase();
      const key = `resumes/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

      const contentType =
        ext === 'pdf'
          ? 'application/pdf'
          : ext === 'docx'
          ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
          : ext === 'doc'
          ? 'application/msword'
          : 'application/octet-stream';

      const { error: upErr } = await supabase.storage
        .from('resumes')
        .upload(key, buffer, { contentType, upsert: false });

      // remove temp file (fire-and-forget)
      fs.unlink(file.filepath, () => {});

      if (upErr) {
        console.error('[upload-resume] Supabase upload error:', upErr);
        return res.status(500).json({ success: false, error: upErr.message || 'Upload failed' });
      }

      const { data } = supabase.storage.from('resumes').getPublicUrl(key);
      const url = data?.publicUrl;
      if (!url) {
        console.error('[upload-resume] No public URL generated');
        return res.status(500).json({ success: false, error: 'Could not generate public URL' });
      }

      return res.status(200).json({ success: true, url });
    } catch (e) {
      console.error('[upload-resume] Server error:', e);
      return res.status(500).json({ success: false, error: e.message || 'Server error' });
    }
  });
};
