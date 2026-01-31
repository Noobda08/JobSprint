const crypto = require('crypto');
const path = require('node:path');
const Busboy = require('busboy');
const { supabaseAdmin } = require('../../lib/_supabase.js');
const { requireAdminAuth } = require('../_admin_auth.js');

const BUCKET_NAME = 'institution-logos';
const SIGNED_URL_SECONDS = 60 * 60 * 24 * 7;

async function ensurePublicBucket() {
  const { data: buckets, error } = await supabaseAdmin.storage.listBuckets();
  if (error) {
    throw new Error(error.message || 'Failed to list storage buckets.');
  }

  const existing = (buckets || []).find((bucket) => bucket.name === BUCKET_NAME);
  if (!existing) {
    const { error: createError } = await supabaseAdmin.storage.createBucket(BUCKET_NAME, {
      public: true
    });
    if (createError) {
      throw new Error(createError.message || 'Failed to create storage bucket.');
    }
    return true;
  }

  if (existing.public) {
    return true;
  }

  const { error: updateError } = await supabaseAdmin.storage.updateBucket(BUCKET_NAME, {
    public: true
  });
  if (updateError) {
    return false;
  }
  return true;
}

function sanitizeFilename(value, fallback = 'logo') {
  const ext = path.extname(value || '').toLowerCase();
  const base = path.basename(value || fallback, ext);
  const safeBase = base.replace(/[^a-z0-9._-]/gi, '_') || fallback;
  const safeExt = ext.replace(/[^a-z0-9.]/gi, '');
  return `${safeBase}${safeExt}`;
}

module.exports = async function handler(req, res) {
  try {
    const auth = requireAdminAuth(req, res);
    if (!auth) {
      return null;
    }

    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'method_not_allowed' });
    }

    const bb = Busboy({ headers: req.headers });
    let fileBuffer = Buffer.alloc(0);
    let filename = '';
    let mime = '';

    await new Promise((resolve, reject) => {
      bb.on('file', (_field, file, info) => {
        filename = info.filename || 'logo';
        mime = info.mimeType || info.mime || '';
        file.on('data', (data) => {
          fileBuffer = Buffer.concat([fileBuffer, data]);
        });
        file.on('end', () => {});
      });
      bb.on('error', reject);
      bb.on('finish', resolve);
      req.pipe(bb);
    });

    if (!fileBuffer.length) {
      return res.status(400).json({ error: 'no_file', message: 'No file uploaded.' });
    }

    const isPublic = await ensurePublicBucket();
    const bucket = supabaseAdmin.storage.from(BUCKET_NAME);
    const safeName = sanitizeFilename(filename);
    const filePath = `${Date.now()}-${crypto.randomUUID()}-${safeName}`;

    const { error: uploadError } = await bucket.upload(filePath, fileBuffer, {
      contentType: mime || 'application/octet-stream',
      upsert: true
    });

    if (uploadError) {
      return res.status(500).json({ error: 'upload_failed', message: uploadError.message || 'Upload failed.' });
    }

    if (isPublic) {
      const { data } = bucket.getPublicUrl(filePath);
      return res.status(200).json({ url: data?.publicUrl || null, path: filePath, public: true });
    }

    const { data, error: signedError } = await bucket.createSignedUrl(filePath, SIGNED_URL_SECONDS);
    if (signedError) {
      return res.status(500).json({ error: 'signed_url_failed', message: signedError.message || 'Signed URL failed.' });
    }

    return res.status(200).json({ url: data?.signedUrl || null, path: filePath, public: false });
  } catch (error) {
    return res.status(500).json({ error: 'server_error', message: error?.message || 'Server error.' });
  }
};
