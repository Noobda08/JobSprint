// /api/parse-resume.js
const Busboy = require('busboy');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');

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

    await new Promise((resolve, reject) => {
      bb.on('file', (_field, file, info) => {
        filename = info.filename || 'resume';
        mime = info.mimeType || info.mime || '';
        file.on('data', d => { fileBuffer = Buffer.concat([fileBuffer, d]); });
        file.on('end', () => {});
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

    return res.status(200).json({ success: true, fields: extract(text) });
  } catch (e) {
    console.error('parse-resume error:', e);
    return res.status(500).json({ error: 'server_error', detail: String(e) });
  }
};
