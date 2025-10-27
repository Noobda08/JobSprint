
const formidable = require('formidable');
const fs = require('fs');
const path = require('path');
const { supabase } = require('./_supabase');

let bucketEnsured = false;

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
      const bucketName = 'resumes';

      // Ensure the bucket exists before attempting an upload. This makes local/dev
      // setups more forgiving when the bucket has not been created manually yet.
      if (!bucketEnsured) {
        try {
          const { data: bucketData, error: bucketErr } = await supabase.storage.getBucket(bucketName);
          if (bucketErr || !bucketData) {
            const { error: createErr } = await supabase.storage.createBucket(bucketName, {
              public: true,
            });
            if (createErr && !/already exists/i.test(createErr.message || '')) {
              throw createErr;
            }
          }
          bucketEnsured = true;
        } catch (bucketError) {
          console.error('[upload-resume] Bucket check/creation failed:', bucketError);
          return res.status(500).json({
            success: false,
            error:
              'Could not access the "resumes" storage bucket. Ensure the Supabase service role key is configured and the bucket exists.',
          });
        }
      }

      const buffer = fs.readFileSync(file.filepath);

      const orig = file.originalFilename || path.basename(file.filepath);
      const ext = (orig.split('.').pop() || 'bin').toLowerCase();
      const key = `${bucketName}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

      const contentType =
        ext === 'pdf'
          ? 'application/pdf'
          : ext === 'docx'
          ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
          : ext === 'doc'
          ? 'application/msword'
          : 'application/octet-stream';

      const { error: upErr } = await supabase.storage
        .from(bucketName)
        .upload(key, buffer, { contentType, upsert: false });

      // remove temp file (fire-and-forget)
      fs.unlink(file.filepath, () => {});

      if (upErr) {
        console.error('[upload-resume] Supabase upload error:', upErr);
        return res.status(500).json({ success: false, error: upErr.message || 'Upload failed' });
      }

      const { data } = supabase.storage.from(bucketName).getPublicUrl(key);
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
