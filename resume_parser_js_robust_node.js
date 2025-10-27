#!/usr/bin/env node
/**
 * resume-parser.js
 * Robust, production-friendly resume text extractor + field parser.
 *
 * Features:
 * - Supports PDF, DOCX, and TXT out of the box
 * - Defensive parsing with multiple heuristics and confidence scores
 * - Experience inference from explicit phrases and employment date ranges
 * - DOB parsing with plausibility checks and normalization (YYYY-MM-DD)
 * - Phone normalization (E.164-leaning, best effort)
 * - Section detection for better name extraction
 * - Optional OCR fallback hooks (scanned PDFs) — disabled by default
 * - CLI usage: `node resume-parser.js <path-to-resume>`
 *
 * Recommended deps:
 *   npm i pdf-parse mammoth
 * Optional (if you enable OCR fallback below):
 *   npm i tesseract.js pdf-image
 *   # Requires ImageMagick/GraphicsMagick + Ghostscript installed on system
 */

const fs = require("fs");
const path = require("path");
const pdfParseMod = require("pdf-parse");
const pdfParse = pdfParseMod && pdfParseMod.default ? pdfParseMod.default : pdfParseMod;
const mammoth = require("mammoth");

/** ===================== Utility & constants ===================== */
const SECTION_HINTS = [
  "summary", "profile", "objective", "experience", "employment", "work history",
  "professional experience", "projects", "education", "skills", "certifications",
  "awards", "publications", "interests", "hobbies", "volunteer", "contact",
  "personal info", "references"
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

function normalizeWhitespace(s = "") {
  return s.replace(/\r/g, "\n").replace(/\t/g, " ").replace(/\u00A0/g, " ").replace(/[ \t]+/g, " ").trim();
}

function linesOf(text = "") {
  return text.split(/\r?\n/).map(l => l.replace(/\s+$/g, "")).filter(Boolean);
}

function isLikelySectionHeader(line = "") {
  const s = line.toLowerCase().trim().replace(/[:.]+$/, "");
  return SECTION_HINTS.includes(s) || /^(experience|education|skills|projects|summary|objective|contact)\b/i.test(s);
}

function plausibleYear(y) {
  const n = Number(y);
  return n >= 1950 && n <= THIS_YEAR + 1;
}

/** ===================== Text extraction ===================== */
async function extractText(filePath) {
  const lower = filePath.toLowerCase();
  const buffer = fs.readFileSync(filePath);

  if (lower.endsWith(".pdf")) {
    try {
      const parsed = await pdfParse(buffer);
      let t = parsed.text || "";
      t = t.replace(/\u0000/g, ""); // scrub nulls seen in some PDFs
      if (t && t.trim().length > 0) return t;

      // Optional: OCR fallback for scanned PDFs (disabled by default)
      // return await ocrPdfFallback(filePath);

      return t; // empty likely means scanned or protected
    } catch (e) {
      // Optional: try OCR fallback
      // return await ocrPdfFallback(filePath);
      throw new Error(`Failed to parse PDF: ${e.message}`);
    }
  } else if (lower.endsWith(".docx")) {
    const { value } = await mammoth.extractRawText({ buffer });
    return value || "";
  } else if (lower.endsWith(".txt")) {
    return buffer.toString("utf8");
  }
  throw new Error("Unsupported file type. Use PDF, DOCX, or TXT.");
}

/**
// Example OCR fallback (disabled). Enable only if you install deps + system binaries.
const { createWorker } = require("tesseract.js");
const { PDFImage } = require("pdf-image");
async function ocrPdfFallback(filePath) {
  const pdfImage = new PDFImage(filePath, { convertOptions: { "-density": "300" } });
  const worker = await createWorker();
  await worker.loadLanguage("eng");
  await worker.initialize("eng");
  try {
    const pageCount = await pdfImage.numberOfPages();
    let text = "";
    for (let i = 0; i < pageCount; i++) {
      const imagePath = await pdfImage.convertPage(i);
      const { data: { text: t } } = await worker.recognize(imagePath);
      text += "\n" + t;
    }
    return text;
  } finally {
    await worker.terminate();
  }
}
*/

/** ===================== Field extractors ===================== */
function extractEmail(text) {
  const m = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  if (!m) return { value: null, confidence: 0 };
  return { value: m[0], confidence: 0.99 };
}

function extractPhones(text) {
  // Capture multiple candidates. Later pick the best.
  const candidates = text.match(/\+?\d[\d\s().-]{8,}\d/g) || [];
  const cleaned = candidates
    .map(s => s.replace(/[^+\d]/g, ""))
    .filter(s => /\d{10,}/.test(s)) // at least 10 digits overall
    .slice(0, 5);

  // Heuristic: prefer numbers starting with + and with 10-15 digits
  let best = null;
  let bestScore = 0;
  for (const raw of cleaned) {
    const digits = raw.replace(/\D/g, "");
    let score = 0.5;
    if (raw.startsWith("+")) score += 0.2;
    if (digits.length >= 10 && digits.length <= 15) score += 0.2;
    if (/^(\+?\d{1,3})?(\d{10})$/.test(raw)) score += 0.05;
    if (score > bestScore) { best = raw; bestScore = score; }
  }
  return { value: best, confidence: best ? clamp(bestScore, 0, 0.98) : 0 };
}

function parseDateFlexible(s) {
  // Accept DD/MM/YYYY, DD-MM-YYYY, YYYY-MM-DD, Month YYYY, Mon YYYY
  s = s.trim();
  let m;
  // 1) YYYY-MM-DD or YYYY/MM/DD
  if ((m = s.match(/^(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})$/))) {
    const [_, y, mo, d] = m;
    if (plausibleYear(y)) return new Date(Number(y), Number(mo) - 1, Number(d));
  }
  // 2) DD-MM-YYYY or DD/MM/YYYY
  if ((m = s.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/))) {
    const [_, d, mo, y] = m;
    if (plausibleYear(y)) return new Date(Number(y), Number(mo) - 1, Number(d));
  }
  // 3) Month YYYY / Mon YYYY
  if ((m = s.match(/^([A-Za-z]{3,9})\s+(\d{4})$/))) {
    const [_, mon, y] = m;
    const mo = MONTHS[mon.toLowerCase()];
    if (mo != null && plausibleYear(y)) return new Date(Number(y), mo, 1);
  }
  return null;
}

function extractDOB(text) {
  // Collect date-like tokens then filter by plausible DOB range (1950..2010-ish)
  const tokens = text.match(/\b(\d{4}[\/-]\d{1,2}[\/-]\d{1,2}|\d{1,2}[\/-]\d{1,2}[\/-]\d{4}|[A-Za-z]{3,9}\s+\d{4})\b/g) || [];
  let best = null;
  for (const t of tokens) {
    const dt = parseDateFlexible(t);
    if (!dt) continue;
    const y = dt.getFullYear();
    // Plausible DOB: 1950..2010 (adjust if needed)
    if (y >= 1950 && y <= 2010) {
      best = dt; // choose the first plausible; could refine with proximity to "DOB" labels
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
  // Return array of {header, start, end}
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
  // Candidate zone: top 10 lines, or before first section header
  const firstSectionStart = sections.length ? sections[0].start : Math.min(lines.length, 20);
  const zone = lines.slice(0, Math.min(10, firstSectionStart));

  // Remove lines that are obviously labels or contact lines
  const candidates = zone
    .map(l => l.replace(/\u00A0/g, " ").trim())
    .filter(l => l && !/^(resume|curriculum vitae|cv)$/i.test(l))
    .filter(l => !(email && l.includes(email)))
    .filter(l => !/^(phone|mobile|email|address|contact)\b/i.test(l))
    .filter(l => l.length <= 80);

  // Heuristic: choose line with 2-4 words, each capitalized like a name
  let best = null, scoreBest = 0;
  for (const l of candidates) {
    const words = l.split(/\s+/).filter(Boolean);
    if (words.length < 1 || words.length > 6) continue;
    let score = 0.2;
    const capCount = words.filter(w => /^[A-Z][a-z'’-]+$/.test(w)).length;
    score += capCount / Math.max(2, words.length);
    if (/\b(\w+\.){1,}\b/.test(l)) score -= 0.2; // too many initials
    if (/[^A-Za-z\s'’-]/.test(l)) score -= 0.2; // digits or symbols — likely not a pure name
    if (score > scoreBest) { best = l; scoreBest = score; }
  }

  return { value: best || null, confidence: best ? clamp(scoreBest, 0, 0.95) : 0 };
}

function monthIndex(token) {
  const t = token.toLowerCase();
  return MONTHS[t];
}

function parseEmploymentRanges(text) {
  // Capture patterns like: Jan 2018 – Mar 2020, 2019 - Present, 07/2016 - 08/2019, etc.
  const ranges = [];
  const patterns = [
    /([A-Za-z]{3,9})\s+(\d{4})\s*[–-]\s*([A-Za-z]{3,9}|present)\s*(\d{4})?/gi,
    /(\d{4})\s*[–-]\s*(\d{4}|present)/gi,
    /(\d{1,2})[\/.-](\d{4})\s*[–-]\s*(\d{1,2})[\/.-](\d{4}|present)/gi,
    /(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})\s*[–-]\s*(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4}|present)/gi
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
  // Interpret various matched forms
  const str = m[0].toLowerCase();
  const present = /present|current/.test(str) ? new Date() : null;

  // Try Month YYYY – Month YYYY
  let md;
  if ((md = str.match(/([a-z]{3,9})\s+(\d{4})\s*[–-]\s*([a-z]{3,9}|present)\s*(\d{4})?/i))) {
    const startMo = monthIndex(md[1]);
    const startYr = Number(md[2]);
    const endMo = md[3] && md[3] !== "present" ? monthIndex(md[3]) : (present ? present.getMonth() : null);
    const endYr = md[4] ? Number(md[4]) : (present ? present.getFullYear() : null);
    if (startMo != null && plausibleYear(startYr)) {
      const s = new Date(startYr, startMo, 1);
      const e = (endMo != null && plausibleYear(endYr)) ? new Date(endYr, endMo, 1) : (present || null);
      if (e && e > s) return { start: s, end: e };
    }
  }

  // Try YYYY – YYYY/present
  if ((md = str.match(/(\d{4})\s*[–-]\s*(\d{4}|present)/))) {
    const sY = Number(md[1]);
    const eY = md[2] === "present" ? present.getFullYear() : Number(md[2]);
    if (plausibleYear(sY) && plausibleYear(eY) && eY >= sY) {
      return { start: new Date(sY, 0, 1), end: new Date(eY, 0, 1) };
    }
  }

  // Try MM/YYYY – MM/YYYY
  if ((md = str.match(/(\d{1,2})[\/.-](\d{4})\s*[–-]\s*(\d{1,2})[\/.-](\d{4})/))) {
    const sM = Number(md[1]) - 1, sY = Number(md[2]);
    const eM = Number(md[3]) - 1, eY = Number(md[4]);
    if (plausibleYear(sY) && plausibleYear(eY)) {
      const s = new Date(sY, sM, 1);
      const e = new Date(eY, eM, 1);
      if (e > s) return { start: s, end: e };
    }
  }

  // Try DD/MM/YYYY – DD/MM/YYYY (fallback to months)
  if ((md = str.match(/(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})\s*[–-]\s*(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})/))) {
    const sY = Number(md[3]), eY = Number(md[6]);
    const sM = Number(md[2]) - 1, eM = Number(md[5]) - 1;
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
      // overlap or contiguous — extend
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
  // Capture phrases like "5 years", "6.5 yrs", "10+ years"
  const matches = text.match(/(\d+(?:\.\d+)?)\s*\+?\s*(years?|yrs?)/gi) || [];
  const values = matches.map(s => parseFloat((s.match(/\d+(?:\.\d+)?/))[0])).filter(n => !isNaN(n) && n <= 60);
  if (!values.length) return null;
  // Heuristic: take the 75th percentile to avoid small stints mentioned repeatedly
  values.sort((a, b) => a - b);
  const idx = Math.floor(values.length * 0.75);
  return values[Math.min(idx, values.length - 1)];
}

function extractExperienceYears(text) {
  const fromRanges = inferExperienceFromRanges(text);
  const fromExplicit = explicitYearsMention(text);
  // Combine with a heuristic
  if (fromRanges && fromExplicit) {
    // Weighted average, but bound by max of the two to avoid inflation
    const blended = clamp(0.6 * fromRanges + 0.4 * fromExplicit, 0, Math.max(fromRanges, fromExplicit));
    const conf = 0.9;
    return { value: Number(blended.toFixed(1)), confidence: conf };
  }
  if (fromRanges) return { value: Number(fromRanges.toFixed(1)), confidence: 0.8 };
  if (fromExplicit) return { value: Number(fromExplicit.toFixed(1)), confidence: 0.6 };
  return { value: null, confidence: 0 };
}

/** ===================== Main parse orchestrator ===================== */
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

async function parseResume(filePath) {
  const raw = await extractText(filePath);
  if (!raw || !raw.trim()) {
    return { error: "No text extracted — likely a scanned or protected PDF. Consider enabling OCR fallback." };
  }

  const text = normalizeWhitespace(raw);
  const email = extractEmail(text);
  const phone = extractPhones(text);
  const dob = extractDOB(text);
  const profiles = extractLinkedProfiles(text);
  const name = extractName(text, email.value);
  const experience = extractExperienceYears(text);

  return buildResult({ name, email, phone, dob, experience, profiles });
}

/** ===================== CLI ===================== */
if (require.main === module) {
  (async () => {
    const target = process.argv[2];
    if (!target) {
      console.error("Usage: node resume-parser.js <path-to-resume.(pdf|docx|txt)>");
      process.exit(1);
    }
    const resolved = path.resolve(process.cwd(), target);
    if (!fs.existsSync(resolved)) {
      console.error("File not found:", resolved);
      process.exit(1);
    }
    try {
      const result = await parseResume(resolved);
      console.log("\n📝 Parsed Resume Fields (with confidence):\n", JSON.stringify(result, null, 2));
    } catch (e) {
      console.error("\n❌ Failed:", e.message);
      process.exit(1);
    }
  })();
}

module.exports = { parseResume, extractText };
