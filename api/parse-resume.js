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
const fs = require('node:fs');
const path = require('node:path');
const Busboy = require('busboy');
let pdfParseLoadError = null;
let pdfParse = null;
const PDF_PARSE_WORKER_CONFIGURED = Symbol.for('pdfParseWorkerConfigured');

function isPdfParseClassCandidate(fn) {
  if (typeof fn !== 'function' || !fn.prototype) return false;
  const proto = fn.prototype;
  const hasLoad = typeof proto.load === 'function';
  const hasGetText = typeof proto.getText === 'function';
  return hasLoad && hasGetText;
}

function isClassLike(fn) {
  if (typeof fn !== 'function' || !fn.prototype) return false;
  const proto = fn.prototype;
  const names = Object.getOwnPropertyNames(proto);
  return names.some(name => name !== 'constructor');
}

function configurePdfParseWorker(Ctor) {
  if (!Ctor || typeof Ctor !== 'function') return;

  const hasSetWorker = typeof Ctor.setWorker === 'function';
  const hasWorkerSrcProp = hasSetWorker || 'workerSrc' in Ctor;
  if (!hasSetWorker && !hasWorkerSrcProp) return;

  if (Ctor[PDF_PARSE_WORKER_CONFIGURED]) return;
  if (typeof Ctor.workerSrc === 'string' && Ctor.workerSrc) {
    Ctor[PDF_PARSE_WORKER_CONFIGURED] = true;
    return;
  }

  let workerSrc = null;
  let entryDir;
  const candidates = [
    () => require.resolve('pdf-parse/dist/pdf-parse/cjs/pdf.worker.mjs'),
    () => require.resolve('pdf-parse/dist/worker/pdf.worker.mjs'),
    () => {
      if (entryDir === undefined) {
        try {
          entryDir = path.dirname(require.resolve('pdf-parse'));
        } catch (_) {
          entryDir = null;
        }
      }
      if (!entryDir) return null;
      const candidate = path.join(entryDir, 'pdf.worker.mjs');
      return fs.existsSync(candidate) ? candidate : null;
    },
    () => {
      if (entryDir === undefined) {
        try {
          entryDir = path.dirname(require.resolve('pdf-parse'));
        } catch (_) {
          entryDir = null;
        }
      }
      if (!entryDir) return null;
      const candidate = path.join(entryDir, '../worker/pdf.worker.mjs');
      return fs.existsSync(candidate) ? candidate : null;
    }
  ];

  for (const resolver of candidates) {
    try {
      workerSrc = resolver();
      if (workerSrc) break;
    } catch (_) {}
  }

  let configured = false;
  if (workerSrc) {
    if (hasSetWorker) {
      try {
        Ctor.setWorker(workerSrc);
        configured = true;
      } catch (_) {}
    } else {
      try {
        Ctor.workerSrc = workerSrc;
        configured = true;
      } catch (_) {}
    }
  }

  if (configured) {
    Ctor[PDF_PARSE_WORKER_CONFIGURED] = true;
  }
}

function createPdfParseClassWrapper(Ctor) {
  return async function parseWithClass(buffer) {
    try {
      configurePdfParseWorker(Ctor);
    } catch (_) {}
    const instance = new Ctor({ data: buffer });
    let text = '';
    try {
      if (typeof instance.load === 'function') await instance.load();
      if (typeof instance.getText === 'function') {
        const value = await instance.getText();
        if (typeof value === 'string') {
          text = value;
        } else if (value && typeof value.text === 'string') {
          text = value.text;
        }
      }
    } finally {
      if (typeof instance.destroy === 'function') {
        try { await instance.destroy(); } catch (_) {}
      }
    }
    return { text };
  };
}

function adaptPdfParseExport(candidate, context) {
  if (typeof candidate !== 'function') return null;
  if (isPdfParseClassCandidate(candidate)) return createPdfParseClassWrapper(candidate);
  if (isClassLike(candidate)) return null;
  return context ? candidate.bind(context) : candidate;
}

function resolvePdfParseExport(mod, seen = new Set()) {
  if (!mod || seen.has(mod)) return null;
  seen.add(mod);

  if (typeof mod === 'function') {
    const direct = adaptPdfParseExport(mod);
    if (direct) return direct;
  }

  const preferredKeys = ['pdfParse', 'PDFParse', 'parse'];
  for (const key of preferredKeys) {
    const value = mod[key];
    const adapted = adaptPdfParseExport(value, mod);
    if (adapted) return adapted;
    if (value && typeof value === 'object') {
      const nested = resolvePdfParseExport(value, seen);
      if (nested) return nested;
    }
  }

  if (mod.default) {
    const adaptedDefault = adaptPdfParseExport(mod.default, mod);
    if (adaptedDefault) return adaptedDefault;
    const nested = resolvePdfParseExport(mod.default, seen);
    if (nested) return nested;
  }

  const values = Object.values(mod);
  for (const value of values) {
    const adapted = adaptPdfParseExport(value, mod);
    if (adapted) return adapted;
  }

  return null;
}

try {
  const mod = require('pdf-parse');
  pdfParse = resolvePdfParseExport(mod);
  if (!pdfParse) {
    const fallback = require('pdf-parse/lib/pdf-parse.js');
    pdfParse = resolvePdfParseExport(fallback);
  }
  if (!pdfParse) {
    pdfParseLoadError = new Error('pdf-parse module did not expose a callable parser');
  }
} catch (err) {
  if (err?.code === 'ERR_REQUIRE_ESM') {
    pdfParse = async (...args) => {
      const imported = await import('pdf-parse');
      const fn = resolvePdfParseExport(imported);
      if (!fn) throw new Error('pdf-parse ESM module did not expose a callable parser');
      return fn(...args);
    };
    pdfParseLoadError = null;
  } else {
    pdfParseLoadError = err;
  }
}

const mammoth = require('mammoth');
const { supabaseAdmin } = require('../lib/_supabase');

/** ===================== Utility & constants ===================== */
const SECTION_HINTS = [
  'summary', 'profile', 'objective', 'experience', 'employment', 'work history',
  'professional experience', 'projects', 'education', 'skills', 'certifications',
  'awards', 'publications', 'interests', 'hobbies', 'volunteer', 'contact',
  'personal info', 'references'
];

const MONTHS = {
  jan: 0, january: 0, feb: 1, february: 1, mar: 2, march: 2, apr: 3, april: 3,
  may: 4, jun: 5, june: 5, jul: 6, july: 6, aug: 7, august: 7,
  sep: 8, sept: 8, september: 8, oct: 9, october: 9, nov: 10, november: 10,
  dec: 11, december: 11
};

const NOW = new Date();
const THIS_YEAR = NOW.getFullYear();

function clamp(num, min, max) {
  return Math.min(Math.max(num, min), max);
}

function normalizeWhitespace(s = '') {
  return s
    .replace(/\r/g, '\n')
    .replace(/\t/g, ' ')
    .replace(/\u00A0/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .trim();
}

function sanitizeResumeTextForStorage(text, maxLength = 60000) {
  if (!text) return '';
  const cleaned = String(text)
    .replace(/\r\n?/g, '\n')
    .replace(/\u00A0/g, ' ')
    .split('\n')
    .map(line => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join('\n')
    .trim();
  if (cleaned.length <= maxLength) return cleaned;
  return `${cleaned.slice(0, maxLength - 1).trimEnd()}…`;
}

function linesOf(text = '') {
  return text
    .split(/\r?\n/)
    .map(l => l.replace(/\s+$/g, ''))
    .filter(Boolean);
}

function isLikelySectionHeader(line = '') {
  const s = line.toLowerCase().trim().replace(/[:.]+$/, '');
  return SECTION_HINTS.includes(s) || /^(experience|education|skills|projects|summary|objective|contact)\b/i.test(s);
}

function plausibleYear(y) {
  const n = Number(y);
  return n >= 1950 && n <= THIS_YEAR + 1;
}

function extractEmail(text) {
  const m = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  if (!m) return { value: null, confidence: 0 };
  return { value: m[0], confidence: 0.99 };
}

function extractPhones(text) {
  const candidates = text.match(/\+?\d[\d\s().-]{8,}\d/g) || [];
  const cleaned = candidates
    .map(s => s.replace(/[^+\d]/g, ''))
    .filter(s => /\d{10,}/.test(s))
    .slice(0, 5);

  let best = null;
  let bestScore = 0;
  for (const raw of cleaned) {
    const digits = raw.replace(/\D/g, '');
    let score = 0.5;
    if (raw.startsWith('+')) score += 0.2;
    if (digits.length >= 10 && digits.length <= 15) score += 0.2;
    if (/^(\+?\d{1,3})?(\d{10})$/.test(raw)) score += 0.05;
    if (score > bestScore) {
      best = raw;
      bestScore = score;
    }
  }
  return { value: best, confidence: best ? clamp(bestScore, 0, 0.98) : 0 };
}

function parseDateFlexible(s) {
  s = s.trim();
  let m;
  if ((m = s.match(/^(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})$/))) {
    const [, y, mo, d] = m;
    if (plausibleYear(y)) return new Date(Number(y), Number(mo) - 1, Number(d));
  }
  if ((m = s.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/))) {
    const [, d, mo, y] = m;
    if (plausibleYear(y)) return new Date(Number(y), Number(mo) - 1, Number(d));
  }
  if ((m = s.match(/^([A-Za-z]{3,9})\s+(\d{4})$/))) {
    const [, mon, y] = m;
    const mo = MONTHS[mon.toLowerCase()];
    if (mo != null && plausibleYear(y)) return new Date(Number(y), mo, 1);
  }
  return null;
}

function extractDOB(text) {
  const tokens = text.match(/\b(\d{4}[\/-]\d{1,2}[\/-]\d{1,2}|\d{1,2}[\/-]\d{1,2}[\/-]\d{4}|[A-Za-z]{3,9}\s+\d{4})\b/g) || [];
  let best = null;
  for (const t of tokens) {
    const dt = parseDateFlexible(t);
    if (!dt) continue;
    const y = dt.getFullYear();
    if (y >= 1950 && y <= 2010) {
      best = dt;
      break;
    }
  }
  if (!best) return { value: null, confidence: 0 };
  const iso = best.toISOString().slice(0, 10);
  return { value: iso, confidence: 0.8 };
}

function extractLinkedProfiles(text) {
  const out = {};
  const linkedIn = text.match(/https?:\/\/(?:[\w.-]+\.)?linkedin\.com\/[\w\/-]+/i);
  const github = text.match(/https?:\/\/(?:www\.)?github\.com\/[\w.-]+/i);
  if (linkedIn) out.linkedin = linkedIn[0];
  if (github) out.github = github[0];
  return out;
}

function detectSections(text) {
  const lines = linesOf(text);
  const sections = [];
  for (let i = 0; i < lines.length; i++) {
    if (isLikelySectionHeader(lines[i])) {
      sections.push({ header: lines[i].trim(), index: i });
    }
  }
  const withBounds = sections.map((s, idx) => ({
    header: s.header,
    start: s.index,
    end: (idx < sections.length - 1 ? sections[idx + 1].index : lines.length) - 1
  }));
  return { lines, sections: withBounds };
}

function extractName(text, email) {
  const { lines, sections } = detectSections(text);
  const firstSectionStart = sections.length ? sections[0].start : Math.min(lines.length, 20);
  const zone = lines.slice(0, Math.min(10, firstSectionStart));

  const candidates = zone
    .map(l => l.replace(/\u00A0/g, ' ').trim())
    .filter(l => l && !/^(resume|curriculum vitae|cv)$/i.test(l))
    .filter(l => !(email && l.includes(email)))
    .filter(l => !/^(phone|mobile|email|address|contact)\b/i.test(l))
    .filter(l => l.length <= 80);

  let best = null;
  let scoreBest = 0;
  for (const l of candidates) {
    const words = l.split(/\s+/).filter(Boolean);
    if (words.length < 1 || words.length > 6) continue;
    let score = 0.2;
    const capCount = words.filter(w => /^[A-Z][a-z'’-]+$/.test(w)).length;
    score += capCount / Math.max(2, words.length);
    if (/\b(\w+\.){1,}\b/.test(l)) score -= 0.2;
    if (/[^A-Za-z\s'’-]/.test(l)) score -= 0.2;
    if (score > scoreBest) {
      best = l;
      scoreBest = score;
    }
  }

  return { value: best || null, confidence: best ? clamp(scoreBest, 0, 0.95) : 0 };
}

function monthIndex(token) {
  const t = token.toLowerCase();
  return MONTHS[t];
}

function parseEmploymentRanges(text) {
  const ranges = [];
  const patterns = [
    /([A-Za-z]{3,9})\s+(\d{4})\s*[–-]\s*([A-Za-z]{3,9}|present)\s*(\d{4})?/gi,
    /(\d{4})\s*[–-]\s*(\d{4}|present)/gi,
    /(\d{1,2})[\/. -](\d{4})\s*[–-]\s*(\d{1,2})[\/. -](\d{4}|present)/gi,
    /(\d{1,2})[\/. -](\d{1,2})[\/. -](\d{4})\s*[–-]\s*(\d{1,2})[\/. -](\d{1,2})[\/. -](\d{4}|present)/gi
  ];

  for (const p of patterns) {
    let m;
    while ((m = p.exec(text)) !== null) {
      ranges.push(m);
    }
  }
  return ranges;
}

function rangeToDates(m) {
  const str = m[0].toLowerCase();
  const present = /present|current/.test(str) ? new Date() : null;

  let md;
  if ((md = str.match(/([a-z]{3,9})\s+(\d{4})\s*[–-]\s*([a-z]{3,9}|present)\s*(\d{4})?/i))) {
    const startMo = monthIndex(md[1]);
    const startYr = Number(md[2]);
    const endMo = md[3] && md[3] !== 'present' ? monthIndex(md[3]) : (present ? present.getMonth() : null);
    const endYr = md[4] ? Number(md[4]) : (present ? present.getFullYear() : null);
    if (startMo != null && plausibleYear(startYr)) {
      const s = new Date(startYr, startMo, 1);
      const e = (endMo != null && plausibleYear(endYr)) ? new Date(endYr, endMo, 1) : (present || null);
      if (e && e > s) return { start: s, end: e };
    }
  }

  if ((md = str.match(/(\d{4})\s*[–-]\s*(\d{4}|present)/))) {
    const sY = Number(md[1]);
    const eY = md[2] === 'present' ? present.getFullYear() : Number(md[2]);
    if (plausibleYear(sY) && plausibleYear(eY) && eY >= sY) {
      return { start: new Date(sY, 0, 1), end: new Date(eY, 0, 1) };
    }
  }

  if ((md = str.match(/(\d{1,2})[\/. -](\d{4})\s*[–-]\s*(\d{1,2})[\/. -](\d{4})/))) {
    const sM = Number(md[1]) - 1;
    const sY = Number(md[2]);
    const eM = Number(md[3]) - 1;
    const eY = Number(md[4]);
    if (plausibleYear(sY) && plausibleYear(eY)) {
      const s = new Date(sY, sM, 1);
      const e = new Date(eY, eM, 1);
      if (e > s) return { start: s, end: e };
    }
  }

  if ((md = str.match(/(\d{1,2})[\/. -](\d{1,2})[\/. -](\d{4})\s*[–-]\s*(\d{1,2})[\/. -](\d{1,2})[\/. -](\d{4})/))) {
    const sY = Number(md[3]);
    const eY = Number(md[6]);
    const sM = Number(md[2]) - 1;
    const eM = Number(md[5]) - 1;
    if (plausibleYear(sY) && plausibleYear(eY)) {
      const s = new Date(sY, sM, 1);
      const e = new Date(eY, eM, 1);
      if (e > s) return { start: s, end: e };
    }
  }

  return null;
}

function mergeRanges(ranges) {
  if (!ranges.length) return [];
  ranges.sort((a, b) => a.start - b.start);
  const merged = [ranges[0]];
  for (let i = 1; i < ranges.length; i++) {
    const prev = merged[merged.length - 1];
    const cur = ranges[i];
    if (cur.start <= prev.end) {
      prev.end = new Date(Math.max(prev.end, cur.end));
    } else {
      merged.push(cur);
    }
  }
  return merged;
}

function monthsBetween(a, b) {
  return (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
}

function inferExperienceFromRanges(text) {
  const raw = parseEmploymentRanges(text);
  const ranges = raw.map(rangeToDates).filter(Boolean);
  const merged = mergeRanges(ranges);
  const totalMonths = merged.reduce((acc, r) => acc + Math.max(0, monthsBetween(r.start, r.end)), 0);
  if (totalMonths <= 0) return null;
  return totalMonths / 12;
}

function explicitYearsMention(text) {
  const matches = text.match(/(\d+(?:\.\d+)?)\s*\+?\s*(years?|yrs?)/gi) || [];
  const values = matches
    .map(s => parseFloat((s.match(/\d+(?:\.\d+)?/))[0]))
    .filter(n => !Number.isNaN(n) && n <= 60);
  if (!values.length) return null;
  values.sort((a, b) => a - b);
  const idx = Math.floor(values.length * 0.75);
  return values[Math.min(idx, values.length - 1)];
}

function extractExperienceYears(text) {
  const fromRanges = inferExperienceFromRanges(text);
  const fromExplicit = explicitYearsMention(text);
  if (fromRanges && fromExplicit) {
    const blended = clamp(0.6 * fromRanges + 0.4 * fromExplicit, 0, Math.max(fromRanges, fromExplicit));
    return { value: Number(blended.toFixed(1)), confidence: 0.9 };
  }
  if (fromRanges) return { value: Number(fromRanges.toFixed(1)), confidence: 0.8 };
  if (fromExplicit) return { value: Number(fromExplicit.toFixed(1)), confidence: 0.6 };
  return { value: null, confidence: 0 };
}

function buildResult({ name, email, phone, dob, experience, profiles }) {
  return {
    name: name.value,
    email: email.value,
    phone: phone.value,
    dob: dob.value,
    experience_years: experience.value,
    profiles,
    _confidence: {
      name: name.confidence,
      email: email.confidence,
      phone: phone.confidence,
      dob: dob.confidence,
      experience_years: experience.confidence
    }
  };
}

function parseResumeText(text) {
  const normalized = normalizeWhitespace(text || '');
  if (!normalized.trim()) {
    return { error: 'No text extracted — likely a scanned or protected PDF. Consider enabling OCR fallback.' };
  }

  const email = extractEmail(normalized);
  const phone = extractPhones(normalized);
  const dob = extractDOB(normalized);
  const profiles = extractLinkedProfiles(normalized);
  const name = extractName(normalized, email.value);
  const experience = extractExperienceYears(normalized);

  return buildResult({ name, email, phone, dob, experience, profiles });
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
      if (!pdfParse || pdfParseLoadError) {
        const reason = pdfParseLoadError ? pdfParseLoadError.message : 'missing pdf-parse export';
        return res.status(500).json({ error: 'pdf_parser_unavailable', detail: reason });
      }
      let parsed;
      try {
        parsed = await pdfParse(fileBuffer);
      } catch (err) {
        return res.status(500).json({ error: 'pdf_parse_failed', detail: err?.message || 'Unknown pdf-parse error' });
      }
      if (typeof parsed === 'string') {
        text = parsed;
      } else {
        text = parsed?.text || '';
      }
    } else if (lower.endsWith('.docx') || mime.includes('wordprocessingml')) {
      const { value } = await mammoth.extractRawText({ buffer: fileBuffer });
      text = value || '';
    } else {
      return res.status(422).json({ error: 'unsupported', detail: 'Use PDF or DOCX' });
    }

    if (!text.trim()) return res.status(422).json({ error: 'empty', detail: 'Could not read text' });

    const rawText = sanitizeResumeTextForStorage(text);
    const parsed = parseResumeText(text);
    if (parsed?.error) {
      return res.status(422).json({ error: 'unreadable', detail: parsed.error });
    }

    const normalizedFields = {
      name: parsed.name || null,
      email: parsed.email || null,
      phone: parsed.phone || null,
      city: null,
      dob: parsed.dob || null,
      role: null,
      experience: typeof parsed.experience_years === 'number' ? parsed.experience_years : null,
      profiles: parsed.profiles || {},
      _confidence: parsed._confidence || {}
    };

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
      fields: normalizedFields,
      parsed,
      raw_text: rawText,
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

module.exports._resolvePdfParseExport = resolvePdfParseExport;
