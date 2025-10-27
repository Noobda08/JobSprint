// /api/parse-resume.js

// --- polyfills for pdf-parse on Vercel ---
let DOMMatrixPoly, ImageDataPoly, Path2DPoly;
try {
  const c = require('canvas');
  DOMMatrixPoly = c.DOMMatrix;
  ImageDataPoly = c.ImageData;
  Path2DPoly = c.Path2D;
} catch (_) {}

if (typeof global.DOMMatrix === 'undefined' && DOMMatrixPoly) global.DOMMatrix = DOMMatrixPoly;
if (typeof global.ImageData === 'undefined' && ImageDataPoly) global.ImageData = ImageDataPoly;
if (typeof global.Path2D === 'undefined' && Path2DPoly) global.Path2D = Path2DPoly;
// --- end polyfills ---


const crypto = require('crypto');
const Busboy = require('busboy');
//const pdfParse = require('pdf-parse');
const pdfParseMod = require('pdf-parse');
const pdfParse = pdfParseMod && pdfParseMod.default ? pdfParseMod.default : pdfParseMod;
const mammoth = require('mammoth');
const { supabaseAdmin } = require('./_supabase');

function extract(text = '') {
  const firstLine = text.split('\n').map(s => s.trim()).find(Boolean) || null;
  const email = (text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i) || [])[0] || null;
  const phone = (text.match(/(\+?\d[\d\s\-().]{8,}\d)/) || [])[0] || null;
  const exp = (text.match(/(\d+(?:\.\d+)?)\s*(?:\+?\s*)?(years?|yrs)/i) || [])[1];
  const dob = (text.match(/\b(\d{4}[-/]\d{2}[-/]\d{2}|\d{2}[-/]\d{2}[-/]\d{4})\b/) || [])[1];
  return {
    name: firstLine,
    email,
    phone,
    city: null,                // keep null if not found (you can fill manually)
    dob: dob ? dob.replace(/\//g, '-') : null,
    role: null,
    experience: exp ? Number(exp) : null,
  };
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });

  try {
    const bb = Busboy({ headers: req.headers });
    let fileBuffer = Buffer.alloc(0);
    let filename = '';
    let mime = '';
    let googleId = '';
    let email = '';

    await new Promise((resolve, reject) => {
      bb.on('file', (_field, file, info) => {
        filename = info.filename || 'resume';
        mime = info.mimeType || info.mime || '';
        file.on('data', d => { fileBuffer = Buffer.concat([fileBuffer, d]); });
        file.on('end', () => {});
      });
      bb.on('field', (name, value) => {
        if (name === 'google_id') googleId = value?.trim?.() || '';
        if (name === 'email') email = value?.trim?.() || '';
      });
      bb.on('error', reject);
      bb.on('finish', resolve);
      req.pipe(bb);
    });

    if (!fileBuffer.length) return res.status(400).json({ error: 'no_file' });

    const lower = filename.toLowerCase();
    let text = '';

    if (lower.endsWith('.pdf') || mime.includes('pdf')) {
      const parsed = await pdfParse(fileBuffer);
      text = parsed.text || '';
    } else if (lower.endsWith('.docx') || mime.includes('wordprocessingml')) {
      const { value } = await mammoth.extractRawText({ buffer: fileBuffer });
      text = value || '';
    } else {
      return res.status(422).json({ error: 'unsupported', detail: 'Use PDF or DOCX' });
    }

    if (!text.trim()) return res.status(422).json({ error: 'empty', detail: 'Could not read text' });

    let resumePath = null;
    let publicUrl = null;

    if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
      try {
        const bucket = supabaseAdmin.storage.from('resumes');
        const ext = (filename.includes('.') ? filename.split('.').pop() : '') || '';
        const safeExt = ext ? `.${ext.replace(/[^a-z0-9]/gi, '')}` : '';
        const baseName = safeExt ? filename.slice(0, -ext.length - 1) : filename;
        const base = baseName.replace(/[^a-z0-9._-]/gi, '_') || 'resume';
        const unique = `${Date.now()}-${crypto.randomUUID()}`;
        const prefix = googleId ? googleId.replace(/[^a-z0-9/_-]/gi, '') + '/' : '';
        resumePath = `${prefix}${unique}-${base}${safeExt}`;

        const { error: uploadErr } = await bucket.upload(resumePath, fileBuffer, {
          contentType: mime || 'application/octet-stream',
          upsert: true
        });

        if (uploadErr) {
          console.error('resume upload failed:', uploadErr);
          resumePath = null;
        } else {
          const { data: publicData } = bucket.getPublicUrl(resumePath);
          publicUrl = publicData?.publicUrl || null;
        }
      } catch (uploadEx) {
        console.error('resume upload exception:', uploadEx);
        resumePath = null;
        publicUrl = null;
      }
    } else {
      console.warn('Supabase environment variables missing; skipping resume upload.');
    }

    return res.status(200).json({
      success: true,
      fields: extract(text),
      resume: {
        path: resumePath,
        public_url: publicUrl,
        original_filename: filename,
        mime,
        google_id: googleId || null,
        email: email || null
      }
    });
  } catch (e) {
    console.error('parse-resume error:', e);
    return res.status(500).json({ error: 'server_error', detail: String(e) });
  }
};
