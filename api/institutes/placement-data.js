const { supabaseAdmin } = require('../../lib/_supabase.js');
const { requireInstituteAuth } = require('../../lib/_institutes_auth.js');

function normalizeBody(body) {
  if (typeof body === 'string') {
    try { return JSON.parse(body || '{}'); } catch (_) { return {}; }
  }
  return body || {};
}

function parseCsvLine(line) {
  const cells = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      cells.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  cells.push(current.trim());
  return cells;
}

function normalizeHeader(header) {
  return String(header || '').replace(/^\ufeff/, '').trim().toLowerCase();
}

function getField(row, keys = []) {
  for (const key of keys) {
    const value = row[normalizeHeader(key)];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
}

function parseCsv(csvText) {
  const lines = String(csvText || '').split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) return [];
  const headers = parseCsvLine(lines[0]).map((h) => normalizeHeader(h));

  return lines.slice(1).map((line) => {
    const cells = parseCsvLine(line);
    return headers.reduce((acc, header, index) => {
      acc[header] = cells[index] || '';
      return acc;
    }, {});
  });
}


function isSchemaNotReadyError(error) {
  const message = String(error?.message || '').toLowerCase();
  return message.includes('schema cache')
    || message.includes('does not exist')
    || message.includes('relation') && message.includes('public.');
}

function mapStage(stage) {
  const value = String(stage || '').toLowerCase();
  if (value === 'offer') return 'offered';
  return value;
}

async function loadPlacementData(institutionId) {
  const { data: drives, error: drivesError } = await supabaseAdmin
    .from('placement_drives')
    .select('id, company_name, title, drive_date, min_cgpa, min_batch_year, allowed_departments, status')
    .eq('institution_id', institutionId)
    .order('drive_date', { ascending: true });
  if (drivesError) throw new Error(drivesError.message || 'Failed to load drives');

  const { data: studentRows, error: studentsError } = await supabaseAdmin
    .from('students')
    .select('id, full_name, email, department, cgpa, batch_year')
    .eq('institution_id', institutionId)
    .order('full_name', { ascending: true });
  if (studentsError) throw new Error(studentsError.message || 'Failed to load students');

  const { data: riskRows, error: riskError } = await supabaseAdmin
    .from('student_risk')
    .select('student_id, risk_status')
    .eq('institution_id', institutionId);
  if (riskError) throw new Error(riskError.message || 'Failed to load risks');

  const riskMap = new Map((riskRows || []).map((row) => [row.student_id, row.risk_status]));

  const students = (studentRows || []).map((row) => ({
    id: row.id,
    name: row.full_name,
    email: row.email,
    dept: row.department,
    cgpa: Number(row.cgpa || 0),
    batch_year: row.batch_year,
    risk_level: riskMap.get(row.id) || 'low',
  }));

  const { data: statuses, error: statusesError } = await supabaseAdmin
    .from('drive_student_status')
    .select('student_id, drive_id, stage')
    .eq('institution_id', institutionId);
  if (statusesError) throw new Error(statusesError.message || 'Failed to load applications');

  const applications = (statuses || []).map((row) => ({
    student_id: row.student_id,
    drive_id: row.drive_id,
    stage: row.stage === 'offered' ? 'offer' : row.stage,
  }));

  const { data: sessions, error: sessionsError } = await supabaseAdmin
    .from('counselling_sessions')
    .select('id, student_id, scheduled_at, status')
    .eq('institution_id', institutionId)
    .order('scheduled_at', { ascending: true });
  if (sessionsError) throw new Error(sessionsError.message || 'Failed to load sessions');

  const { data: notesRows, error: notesError } = await supabaseAdmin
    .from('counselling_notes')
    .select('id, student_id, note_text, created_at')
    .eq('institution_id', institutionId)
    .order('created_at', { ascending: false });
  if (notesError) throw new Error(notesError.message || 'Failed to load notes');

  const counselling_notes = (notesRows || []).map((row) => ({
    id: row.id,
    student_id: row.student_id,
    note: row.note_text,
    created_at: row.created_at,
  }));

  const normalizedDrives = (drives || []).map((row) => ({
    id: row.id,
    company: row.company_name,
    role: row.title,
    date: row.drive_date,
    min_cgpa: Number(row.min_cgpa || 0),
    min_batch_year: row.min_batch_year,
    allowed_departments: row.allowed_departments || [],
    status: row.status || 'upcoming',
  }));

  return {
    drives: normalizedDrives,
    students,
    applications,
    counselling_sessions: sessions || [],
    counselling_notes,
  };
}

async function importCsvDataset({ institutionId, dataset, csvText }) {
  const rows = parseCsv(csvText);
  if (!rows.length) return { imported: 0, dataset };

  if (dataset === 'drives') {
    const payload = rows.map((row) => ({
      institution_id: institutionId,
      company_name: row.company,
      title: row.role,
      drive_date: row.date,
      min_cgpa: row.min_cgpa ? Number(row.min_cgpa) : null,
      min_batch_year: row.min_batch_year ? Number(row.min_batch_year) : null,
      allowed_departments: row.allowed_departments ? row.allowed_departments.split('|').map((d) => d.trim()).filter(Boolean) : [],
      status: row.status || 'upcoming',
    })).filter((row) => row.company_name && row.title && row.drive_date);

    if (!payload.length) return { imported: 0, dataset };

    const { error } = await supabaseAdmin.from('placement_drives').upsert(payload, {
      onConflict: 'institution_id,company_name,title,drive_date',
    });
    if (error) throw new Error(error.message || 'Failed to import drives');
    return { imported: payload.length, dataset };
  }

  if (dataset === 'students') {
    const studentPayload = rows.map((row) => ({
      institution_id: institutionId,
      full_name: getField(row, ['name', 'full_name']),
      email: String(getField(row, ['email', 'student_email']) || '').toLowerCase(),
      department: getField(row, ['dept', 'department']),
      cgpa: getField(row, ['cgpa']) ? Number(getField(row, ['cgpa'])) : null,
      batch_year: getField(row, ['batch_year', 'batch']) ? Number(getField(row, ['batch_year', 'batch'])) : null,
    })).filter((row) => row.full_name && row.email && row.batch_year);

    if (!studentPayload.length) {
      return {
        imported: 0,
        dataset,
        warning: 'No valid student rows found. Expected headers include email + (name/full_name) + (dept/department) + batch_year.',
      };
    }

    const { error } = await supabaseAdmin.from('students').upsert(studentPayload, {
      onConflict: 'institution_id,email',
    });
    if (error) throw new Error(error.message || 'Failed to import students');

    const { data: studentRows, error: fetchError } = await supabaseAdmin
      .from('students')
      .select('id, email')
      .eq('institution_id', institutionId)
      .in('email', studentPayload.map((row) => row.email));
    if (fetchError) throw new Error(fetchError.message || 'Failed to map students');
    const studentByEmail = new Map((studentRows || []).map((row) => [row.email.toLowerCase(), row.id]));

    const riskPayload = rows
      .filter((row) => getField(row, ['risk_level', 'risk']) && studentByEmail.get(String(getField(row, ['email', 'student_email']) || '').toLowerCase()))
      .map((row) => ({
        institution_id: institutionId,
        student_id: studentByEmail.get(String(getField(row, ['email', 'student_email']) || '').toLowerCase()),
        risk_status: getField(row, ['risk_level', 'risk']).toLowerCase(),
      }));

    if (riskPayload.length) {
      const { error: riskUpsertError } = await supabaseAdmin.from('student_risk').upsert(riskPayload, {
        onConflict: 'student_id',
      });
      if (riskUpsertError) throw new Error(riskUpsertError.message || 'Failed to import risk levels');
    }

    return { imported: studentPayload.length, dataset };
  }

  if (dataset === 'applications') {
    const studentEmails = [...new Set(rows.map((row) => String(row.student_email || '').toLowerCase()).filter(Boolean))];
    const { data: studentRows, error: studentError } = await supabaseAdmin
      .from('students')
      .select('id, email')
      .eq('institution_id', institutionId)
      .in('email', studentEmails);
    if (studentError) throw new Error(studentError.message || 'Failed to resolve students');
    const studentByEmail = new Map((studentRows || []).map((row) => [row.email.toLowerCase(), row.id]));

    const { data: driveRows, error: driveError } = await supabaseAdmin
      .from('placement_drives')
      .select('id, company_name, title, drive_date')
      .eq('institution_id', institutionId);
    if (driveError) throw new Error(driveError.message || 'Failed to resolve drives');
    const driveByKey = new Map((driveRows || []).map((row) => [`${row.company_name}|${row.title}|${row.drive_date}`, row.id]));

    const payload = rows.map((row) => ({
      institution_id: institutionId,
      student_id: studentByEmail.get(String(row.student_email || '').toLowerCase()),
      drive_id: driveByKey.get(`${row.drive_company}|${row.drive_role}|${row.drive_date}`),
      stage: mapStage(row.stage),
    })).filter((row) => row.student_id && row.drive_id && row.stage);

    if (!payload.length) return { imported: 0, dataset };

    const { error } = await supabaseAdmin.from('drive_student_status').upsert(payload, {
      onConflict: 'drive_id,student_id',
    });
    if (error) throw new Error(error.message || 'Failed to import applications');
    return { imported: payload.length, dataset };
  }

  if (dataset === 'counselling_sessions') {
    const studentEmails = [...new Set(rows.map((row) => String(row.student_email || '').toLowerCase()).filter(Boolean))];
    const { data: studentRows, error: studentError } = await supabaseAdmin
      .from('students')
      .select('id, email')
      .eq('institution_id', institutionId)
      .in('email', studentEmails);
    if (studentError) throw new Error(studentError.message || 'Failed to resolve students');
    const studentByEmail = new Map((studentRows || []).map((row) => [row.email.toLowerCase(), row.id]));

    const payload = rows.map((row) => ({
      institution_id: institutionId,
      student_id: studentByEmail.get(String(row.student_email || '').toLowerCase()),
      scheduled_at: row.scheduled_at,
      status: String(row.status || '').toLowerCase(),
    })).filter((row) => row.student_id && row.scheduled_at && row.status);

    if (!payload.length) return { imported: 0, dataset };

    const { error } = await supabaseAdmin.from('counselling_sessions').insert(payload);
    if (error) throw new Error(error.message || 'Failed to import counselling sessions');
    return { imported: payload.length, dataset };
  }

  if (dataset === 'counselling_notes') {
    const studentEmails = [...new Set(rows.map((row) => String(row.student_email || '').toLowerCase()).filter(Boolean))];
    const { data: studentRows, error: studentError } = await supabaseAdmin
      .from('students')
      .select('id, email')
      .eq('institution_id', institutionId)
      .in('email', studentEmails);
    if (studentError) throw new Error(studentError.message || 'Failed to resolve students');
    const studentByEmail = new Map((studentRows || []).map((row) => [row.email.toLowerCase(), row.id]));

    const payload = rows.map((row) => ({
      institution_id: institutionId,
      student_id: studentByEmail.get(String(row.student_email || '').toLowerCase()),
      note_text: row.note,
      created_at: row.created_at || new Date().toISOString(),
    })).filter((row) => row.student_id && row.note_text);

    if (!payload.length) return { imported: 0, dataset };

    const { error } = await supabaseAdmin.from('counselling_notes').insert(payload);
    if (error) throw new Error(error.message || 'Failed to import counselling notes');
    return { imported: payload.length, dataset };
  }

  throw new Error('Unsupported dataset. Use drives, students, applications, counselling_sessions, counselling_notes.');
}

module.exports = async function handler(req, res) {
  try {
    const auth = requireInstituteAuth(req, res);
    if (!auth) return null;

    if (req.method === 'GET') {
      const data = await loadPlacementData(auth.institution_id);
      return res.status(200).json(data);
    }

    if (req.method === 'POST') {
      const body = normalizeBody(req.body);
      const dataset = String(body.dataset || '').trim();
      const csv = body.csv || '';

      if (!dataset || !csv) {
        return res.status(400).json({ error: 'missing_fields', message: 'dataset and csv are required.' });
      }

      const result = await importCsvDataset({ institutionId: auth.institution_id, dataset, csvText: csv });
      return res.status(200).json({ ok: true, ...result });
    }

    return res.status(405).json({ error: 'method_not_allowed' });
  } catch (error) {
    if (isSchemaNotReadyError(error)) {
      return res.status(503).json({
        error: 'schema_not_ready',
        message: 'Institute placement tables are not set up yet. Please run Supabase migrations before using the Institutes dashboard.',
        detail: error?.message || 'Schema is missing required placement tables.',
      });
    }

    return res.status(500).json({ error: 'server_error', message: error?.message || 'Server error.' });
  }
};
