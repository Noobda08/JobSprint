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
    .select('id, student_id, drive_id, stage')
    .eq('institution_id', institutionId);
  if (statusesError) throw new Error(statusesError.message || 'Failed to load applications');

  const applications = (statuses || []).map((row) => ({
    id: row.id,
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



async function createRecord({ institutionId, dataset, record }) {
  if (dataset === 'students') {
    const payload = {
      institution_id: institutionId,
      full_name: record.full_name || record.name,
      email: String(record.email || '').toLowerCase(),
      department: record.department || record.dept || null,
      cgpa: record.cgpa ? Number(record.cgpa) : null,
      batch_year: record.batch_year ? Number(record.batch_year) : null,
    };
    if (!payload.full_name || !payload.email || !payload.batch_year) throw new Error('Students require full_name/name, email and batch_year.');
    const { data, error } = await supabaseAdmin.from('students').insert(payload).select('id').single();
    if (error) throw new Error(error.message || 'Failed to create student');

    const risk = (record.risk_level || record.risk || '').toLowerCase();
    if (risk) {
      const { error: riskError } = await supabaseAdmin.from('student_risk').upsert({
        institution_id: institutionId,
        student_id: data.id,
        risk_status: risk,
      }, { onConflict: 'student_id' });
      if (riskError) throw new Error(riskError.message || 'Failed to set risk level');
    }
    return data;
  }

  if (dataset === 'drives') {
    const payload = {
      institution_id: institutionId,
      company_name: record.company_name || record.company,
      title: record.title || record.role,
      drive_date: record.drive_date || record.date,
      min_cgpa: record.min_cgpa ? Number(record.min_cgpa) : null,
      min_batch_year: record.min_batch_year ? Number(record.min_batch_year) : null,
      allowed_departments: Array.isArray(record.allowed_departments) ? record.allowed_departments : String(record.allowed_departments || '').split('|').map((d) => d.trim()).filter(Boolean),
      status: record.status || 'upcoming',
    };
    if (!payload.company_name || !payload.title || !payload.drive_date) throw new Error('Drives require company/company_name, role/title and date/drive_date.');
    const { data, error } = await supabaseAdmin.from('placement_drives').insert(payload).select('id').single();
    if (error) throw new Error(error.message || 'Failed to create drive');
    return data;
  }

  if (dataset === 'applications') {
    const payload = {
      institution_id: institutionId,
      student_id: record.student_id,
      drive_id: record.drive_id,
      stage: mapStage(record.stage),
    };
    if (!payload.student_id || !payload.drive_id || !payload.stage) throw new Error('Applications require student_id, drive_id and stage.');
    const { data, error } = await supabaseAdmin.from('drive_student_status').insert(payload).select('id').single();
    if (error) throw new Error(error.message || 'Failed to create application');
    return data;
  }

  if (dataset === 'counselling_sessions') {
    const payload = {
      institution_id: institutionId,
      student_id: record.student_id,
      scheduled_at: record.scheduled_at,
      status: String(record.status || '').toLowerCase(),
    };
    if (!payload.student_id || !payload.scheduled_at || !payload.status) throw new Error('Counselling sessions require student_id, scheduled_at and status.');
    const { data, error } = await supabaseAdmin.from('counselling_sessions').insert(payload).select('id').single();
    if (error) throw new Error(error.message || 'Failed to create counselling session');
    return data;
  }

  if (dataset === 'counselling_notes') {
    const payload = {
      institution_id: institutionId,
      student_id: record.student_id,
      note_text: record.note_text || record.note,
      created_at: record.created_at || new Date().toISOString(),
    };
    if (!payload.student_id || !payload.note_text) throw new Error('Counselling notes require student_id and note/note_text.');
    const { data, error } = await supabaseAdmin.from('counselling_notes').insert(payload).select('id').single();
    if (error) throw new Error(error.message || 'Failed to create counselling note');
    return data;
  }

  throw new Error('Unsupported dataset for create.');
}

async function updateRecord({ institutionId, dataset, id, updates }) {
  if (!id) throw new Error('id is required for update.');

  if (dataset === 'students') {
    const studentUpdates = {};
    if (updates.full_name || updates.name) studentUpdates.full_name = updates.full_name || updates.name;
    if (updates.email) studentUpdates.email = String(updates.email).toLowerCase();
    if (updates.department || updates.dept) studentUpdates.department = updates.department || updates.dept;
    if (updates.cgpa !== undefined) studentUpdates.cgpa = updates.cgpa === '' ? null : Number(updates.cgpa);
    if (updates.batch_year !== undefined) studentUpdates.batch_year = updates.batch_year === '' ? null : Number(updates.batch_year);

    if (Object.keys(studentUpdates).length) {
      const { error } = await supabaseAdmin.from('students').update(studentUpdates).eq('id', id).eq('institution_id', institutionId);
      if (error) throw new Error(error.message || 'Failed to update student');
    }

    if (updates.risk_level || updates.risk) {
      const { error: riskError } = await supabaseAdmin.from('student_risk').upsert({
        institution_id: institutionId,
        student_id: id,
        risk_status: String(updates.risk_level || updates.risk).toLowerCase(),
      }, { onConflict: 'student_id' });
      if (riskError) throw new Error(riskError.message || 'Failed to update risk');
    }
    return true;
  }

  if (dataset === 'drives') {
    const driveUpdates = {};
    if (updates.company_name || updates.company) driveUpdates.company_name = updates.company_name || updates.company;
    if (updates.title || updates.role) driveUpdates.title = updates.title || updates.role;
    if (updates.drive_date || updates.date) driveUpdates.drive_date = updates.drive_date || updates.date;
    if (updates.min_cgpa !== undefined) driveUpdates.min_cgpa = updates.min_cgpa === '' ? null : Number(updates.min_cgpa);
    if (updates.min_batch_year !== undefined) driveUpdates.min_batch_year = updates.min_batch_year === '' ? null : Number(updates.min_batch_year);
    if (updates.allowed_departments !== undefined) driveUpdates.allowed_departments = Array.isArray(updates.allowed_departments) ? updates.allowed_departments : String(updates.allowed_departments || '').split('|').map((d) => d.trim()).filter(Boolean);
    if (updates.status) driveUpdates.status = updates.status;

    const { error } = await supabaseAdmin.from('placement_drives').update(driveUpdates).eq('id', id).eq('institution_id', institutionId);
    if (error) throw new Error(error.message || 'Failed to update drive');
    return true;
  }

  if (dataset === 'applications') {
    const appUpdates = {};
    if (updates.student_id) appUpdates.student_id = updates.student_id;
    if (updates.drive_id) appUpdates.drive_id = updates.drive_id;
    if (updates.stage) appUpdates.stage = mapStage(updates.stage);
    const { error } = await supabaseAdmin.from('drive_student_status').update(appUpdates).eq('id', id).eq('institution_id', institutionId);
    if (error) throw new Error(error.message || 'Failed to update application');
    return true;
  }

  if (dataset === 'counselling_sessions') {
    const sessionUpdates = {};
    if (updates.student_id) sessionUpdates.student_id = updates.student_id;
    if (updates.scheduled_at) sessionUpdates.scheduled_at = updates.scheduled_at;
    if (updates.status) sessionUpdates.status = String(updates.status).toLowerCase();
    const { error } = await supabaseAdmin.from('counselling_sessions').update(sessionUpdates).eq('id', id).eq('institution_id', institutionId);
    if (error) throw new Error(error.message || 'Failed to update counselling session');
    return true;
  }

  if (dataset === 'counselling_notes') {
    const noteUpdates = {};
    if (updates.student_id) noteUpdates.student_id = updates.student_id;
    if (updates.note_text || updates.note) noteUpdates.note_text = updates.note_text || updates.note;
    if (updates.created_at) noteUpdates.created_at = updates.created_at;
    const { error } = await supabaseAdmin.from('counselling_notes').update(noteUpdates).eq('id', id).eq('institution_id', institutionId);
    if (error) throw new Error(error.message || 'Failed to update counselling note');
    return true;
  }

  throw new Error('Unsupported dataset for update.');
}

async function deleteRecord({ institutionId, dataset, id }) {
  if (!id) throw new Error('id is required for delete.');

  if (dataset === 'students') {
    await supabaseAdmin.from('student_risk').delete().eq('student_id', id).eq('institution_id', institutionId);
    const { error } = await supabaseAdmin.from('students').delete().eq('id', id).eq('institution_id', institutionId);
    if (error) throw new Error(error.message || 'Failed to delete student');
    return true;
  }

  const tableByDataset = {
    drives: 'placement_drives',
    applications: 'drive_student_status',
    counselling_sessions: 'counselling_sessions',
    counselling_notes: 'counselling_notes',
  };
  const table = tableByDataset[dataset];
  if (!table) throw new Error('Unsupported dataset for delete.');
  const { error } = await supabaseAdmin.from(table).delete().eq('id', id).eq('institution_id', institutionId);
  if (error) throw new Error(error.message || 'Failed to delete record');
  return true;
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

    if (req.method === 'PUT') {
      const body = normalizeBody(req.body);
      const dataset = String(body.dataset || '').trim();
      const record = body.record || {};
      if (!dataset || !record || typeof record !== 'object') {
        return res.status(400).json({ error: 'missing_fields', message: 'dataset and record are required.' });
      }
      const created = await createRecord({ institutionId: auth.institution_id, dataset, record });
      return res.status(200).json({ ok: true, created });
    }

    if (req.method === 'PATCH') {
      const body = normalizeBody(req.body);
      const dataset = String(body.dataset || '').trim();
      const id = body.id;
      const updates = body.updates || {};
      if (!dataset || !id || !updates || typeof updates !== 'object') {
        return res.status(400).json({ error: 'missing_fields', message: 'dataset, id and updates are required.' });
      }
      await updateRecord({ institutionId: auth.institution_id, dataset, id, updates });
      return res.status(200).json({ ok: true });
    }

    if (req.method === 'DELETE') {
      const body = normalizeBody(req.body);
      const dataset = String(body.dataset || '').trim();
      const id = body.id;
      if (!dataset || !id) {
        return res.status(400).json({ error: 'missing_fields', message: 'dataset and id are required.' });
      }
      await deleteRecord({ institutionId: auth.institution_id, dataset, id });
      return res.status(200).json({ ok: true });
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
