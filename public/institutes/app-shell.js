import { createDatasetRecord, deleteDatasetRecord, loadPlacementData, updateDatasetRecord, uploadCsvDataset } from '/institutes/data-client.js';

const SAMPLE_CSV = {
  drives: [
    'company,role,date,min_cgpa,min_batch_year,allowed_departments,status',
    'Astra Systems,Software Engineer,2026-03-12,7.0,2026,CSE|IT|ECE,upcoming',
  ].join('\n'),
  students: [
    'name,email,dept,cgpa,batch_year,risk_level',
    'Aarav Sharma,aarav.sharma@campus.edu,CSE,7.8,2026,medium',
  ].join('\n'),
  applications: [
    'student_email,drive_company,drive_role,drive_date,stage',
    'aarav.sharma@campus.edu,Astra Systems,Software Engineer,2026-03-12,applied',
  ].join('\n'),
  counselling_sessions: [
    'student_email,scheduled_at,status',
    'aarav.sharma@campus.edu,2026-03-20T11:00:00,scheduled',
  ].join('\n'),
  counselling_notes: [
    'student_email,note,created_at',
    'aarav.sharma@campus.edu,Needs mock interview support,2026-03-21T09:30:00',
  ].join('\n'),
};

const DATASET_MAPPING_CONFIG = {
  students: {
    required: ['email', 'full_name', 'department', 'batch_year'],
    optional: ['cgpa', 'risk_level'],
    aliases: {
      full_name: ['full_name', 'name'],
      department: ['department', 'dept'],
      risk_level: ['risk_level', 'risk'],
    },
  },
  drives: {
    required: ['company', 'role', 'date'],
    optional: ['min_cgpa', 'min_batch_year', 'allowed_departments', 'status'],
    aliases: {},
  },
  applications: {
    required: ['student_email', 'drive_company', 'drive_role', 'drive_date', 'stage'],
    optional: [],
    aliases: {},
  },
  counselling_sessions: {
    required: ['student_email', 'scheduled_at', 'status'],
    optional: [],
    aliases: {},
  },
  counselling_notes: {
    required: ['student_email', 'note'],
    optional: ['created_at'],
    aliases: {},
  },
};

export function requireInstituteAuth() {
  const token = localStorage.getItem('institutes_token');
  if (!token) {
    window.location.href = '/institutes/login.html';
    return null;
  }
  return token;
}

export async function loadInstituteBranding(token) {
  const fallback = { name: 'Institute', tagline: 'Placement Center', logo_url: '' };
  if (!token) return fallback;

  try {
    const response = await fetch('/api/institutes/me', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) return fallback;
    const data = await response.json();
    return data?.institution || data || fallback;
  } catch (error) {
    return fallback;
  }
}

export function applyBranding(branding) {
  const name = branding?.name || 'Institute';
  const tagline = branding?.tagline || 'Placement Center';
  const logo = branding?.logo_url || '';

  document.querySelectorAll('[data-brand-name]').forEach((el) => {
    el.textContent = name;
  });
  document.querySelectorAll('[data-brand-sub]').forEach((el) => {
    el.textContent = tagline;
  });
  document.querySelectorAll('[data-brand-logo]').forEach((el) => {
    el.textContent = name.slice(0, 2).toUpperCase();
  });

  document.querySelectorAll('[data-brand-panel-logo]').forEach((container) => {
    const img = container.querySelector('[data-brand-panel-logo-img]');
    if (!img) return;
    if (logo) {
      img.src = logo;
      img.alt = `${name} logo`;
      container.hidden = false;
    } else {
      img.removeAttribute('src');
      container.hidden = true;
    }
  });

  document.querySelectorAll('[data-brand-panel-logo]').forEach((container) => {
    const img = container.querySelector('[data-brand-panel-logo-img]');
    if (!img) return;
    if (logo) {
      img.src = logo;
      img.alt = `${name} logo`;
      container.hidden = false;
    } else {
      img.removeAttribute('src');
      container.hidden = true;
    }
  });
}

export function setActiveNav(pageKey) {
  document.querySelectorAll('[data-nav]').forEach((link) => {
    if (link.dataset.nav === pageKey) {
      link.classList.add('active');
    } else {
      link.classList.remove('active');
    }
  });
}

export function formatDate(dateValue) {
  const date = new Date(dateValue);
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function formatDateTime(dateValue) {
  const date = new Date(dateValue);
  return date.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function getQueryNumber(key) {
  const url = new URL(window.location.href);
  const value = Number(url.searchParams.get(key));
  return Number.isNaN(value) ? null : value;
}

export function bindPlaceholderActions(root = document) {
  root.addEventListener('click', (event) => {
    const actionEl = event.target.closest('[data-placeholder-action]');
    if (!actionEl) return;
    const actionLabel = actionEl.dataset.placeholderAction || 'Action';
    const sectionLabel = actionEl.dataset.section || 'this section';
    window.alert(`${actionLabel} for ${sectionLabel} is a demo placeholder. Integrations are coming soon.`);
  });
}

function normalizeHeader(header) {
  return String(header || '').replace(/^\ufeff/, '').trim();
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
      cells.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  cells.push(current);
  return cells;
}

function csvEscape(value) {
  const text = String(value ?? '');
  if (text.includes(',') || text.includes('"') || text.includes('\n')) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function parseCsvText(csvText) {
  const lines = String(csvText || '').split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) return null;
  const headers = parseCsvLine(lines[0]).map(normalizeHeader);
  const rows = lines.slice(1).map((line) => parseCsvLine(line));
  return { headers, rows };
}

function suggestHeaderMatch(targetField, sourceHeaders, aliases = {}) {
  const normalizedHeaders = sourceHeaders.map((header) => header.toLowerCase());
  const candidates = [targetField, ...(aliases[targetField] || [])].map((value) => value.toLowerCase());
  for (const candidate of candidates) {
    const idx = normalizedHeaders.indexOf(candidate);
    if (idx >= 0) return sourceHeaders[idx];
  }
  return '';
}

function openColumnMappingModal(dataset, sourceHeaders) {
  const config = DATASET_MAPPING_CONFIG[dataset];
  if (!config) return Promise.resolve(null);

  const fields = [...config.required, ...config.optional];

  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'csv-map-overlay';

    const modal = document.createElement('div');
    modal.className = 'csv-map-modal';

    const title = document.createElement('h3');
    title.textContent = `Map CSV columns (${dataset})`;

    const subtitle = document.createElement('p');
    subtitle.textContent = 'Please map your CSV columns before upload.';

    const form = document.createElement('div');
    form.className = 'csv-map-form';

    const selects = new Map();

    fields.forEach((field) => {
      const row = document.createElement('div');
      row.className = 'csv-map-row';

      const label = document.createElement('label');
      const requiredMark = config.required.includes(field) ? ' *' : '';
      label.textContent = `${field}${requiredMark}`;

      const select = document.createElement('select');
      const empty = document.createElement('option');
      empty.value = '';
      empty.textContent = '-- Ignore --';
      select.append(empty);

      sourceHeaders.forEach((header) => {
        const option = document.createElement('option');
        option.value = header;
        option.textContent = header;
        select.append(option);
      });

      select.value = suggestHeaderMatch(field, sourceHeaders, config.aliases);
      selects.set(field, select);

      row.append(label, select);
      form.append(row);
    });

    const actions = document.createElement('div');
    actions.className = 'csv-map-actions';

    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.className = 'btn secondary';
    cancelBtn.textContent = 'Cancel';

    const submitBtn = document.createElement('button');
    submitBtn.type = 'button';
    submitBtn.className = 'btn primary';
    submitBtn.textContent = 'Continue Upload';

    cancelBtn.addEventListener('click', () => {
      overlay.remove();
      resolve(null);
    });

    submitBtn.addEventListener('click', () => {
      const mapping = {};
      for (const [field, select] of selects.entries()) {
        mapping[field] = select.value;
      }

      const missing = config.required.filter((field) => !mapping[field]);
      if (missing.length) {
        window.alert(`Please map required fields: ${missing.join(', ')}`);
        return;
      }

      overlay.remove();
      resolve(mapping);
    });

    actions.append(cancelBtn, submitBtn);
    modal.append(title, subtitle, form, actions);
    overlay.append(modal);
    document.body.append(overlay);
  });
}

function remapCsvForUpload(dataset, csvText, mapping) {
  const parsed = parseCsvText(csvText);
  if (!parsed) return csvText;

  const config = DATASET_MAPPING_CONFIG[dataset];
  if (!config) return csvText;

  const targetHeaders = [...config.required, ...config.optional].filter((field) => mapping[field]);
  const headerIndex = new Map(parsed.headers.map((header, idx) => [header, idx]));

  const csvRows = [targetHeaders.join(',')];
  parsed.rows.forEach((row) => {
    const mappedCells = targetHeaders.map((field) => {
      const sourceHeader = mapping[field];
      const idx = headerIndex.get(sourceHeader);
      return csvEscape(idx === undefined ? '' : (row[idx] || '').trim());
    });
    csvRows.push(mappedCells.join(','));
  });

  return csvRows.join('\n');
}

export function bindCsvUploadActions(token, { onUploaded } = {}) {
  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = '.csv,text/csv';
  fileInput.style.display = 'none';
  document.body.append(fileInput);

  let pendingDataset = null;

  fileInput.addEventListener('change', async () => {
    const file = fileInput.files && fileInput.files[0];
    if (!file || !pendingDataset) return;

    const originalCsvText = await file.text();

    try {
      const parsed = parseCsvText(originalCsvText);
      if (!parsed) {
        throw new Error('CSV must include headers and at least one data row.');
      }

      const mapping = await openColumnMappingModal(pendingDataset, parsed.headers);
      if (!mapping) {
        return;
      }

      const remappedCsvText = remapCsvForUpload(pendingDataset, originalCsvText, mapping);
      const result = await uploadCsvDataset(token, pendingDataset, remappedCsvText);
      const warning = result.warning ? `\n\n${result.warning}` : '';
      window.alert(`Uploaded ${result.imported || 0} rows to ${pendingDataset}.${warning}`);
      if (typeof onUploaded === 'function') await onUploaded();
    } catch (error) {
      window.alert(error?.message || 'CSV upload failed.');
    } finally {
      fileInput.value = '';
      pendingDataset = null;
    }
  });

  document.addEventListener('click', (event) => {
    const button = event.target.closest('[data-upload-dataset]');
    if (!button) return;
    pendingDataset = button.dataset.uploadDataset;
    fileInput.click();
  });
}



function getDatasetRecords(payload, dataset) {
  return Array.isArray(payload?.[dataset]) ? payload[dataset] : [];
}

function openJsonEditor(title, initialValue = '{}') {
  const response = window.prompt(title, initialValue);
  if (response === null) return null;
  const trimmed = response.trim();
  if (!trimmed) return {};
  return JSON.parse(trimmed);
}

export function bindRecordManagement(token, { onChanged } = {}) {
  document.addEventListener('click', async (event) => {
    const button = event.target.closest('[data-manage-dataset]');
    if (!button) return;

    const dataset = button.dataset.manageDataset;
    try {
      const data = await loadPlacementData(token, { force: true });
      const records = getDatasetRecords(data, dataset);

      const idInput = window.prompt(
        `Manage ${dataset}\nType: add | edit:<id> | delete:<id> | list\nCurrent rows: ${records.length}`
      );
      if (!idInput) return;

      const command = idInput.trim();
      if (command === 'list') {
        const preview = records.slice(0, 20).map((row) => JSON.stringify(row)).join('\n');
        window.alert(preview || `No records in ${dataset}.`);
        return;
      }

      if (command === 'add') {
        const record = openJsonEditor(`Add ${dataset} record as JSON`, '{}');
        if (!record) return;
        await createDatasetRecord(token, dataset, record);
        window.alert(`Added record to ${dataset}.`);
        if (typeof onChanged === 'function') await onChanged();
        return;
      }

      if (command.startsWith('edit:')) {
        const id = command.slice(5).trim();
        const existing = records.find((row) => String(row.id) === id);
        const updates = openJsonEditor(`Edit ${dataset} ${id} with JSON updates`, JSON.stringify(existing || {}, null, 2));
        if (!updates) return;
        await updateDatasetRecord(token, dataset, id, updates);
        window.alert(`Updated ${dataset} record ${id}.`);
        if (typeof onChanged === 'function') await onChanged();
        return;
      }

      if (command.startsWith('delete:')) {
        const id = command.slice(7).trim();
        const confirmed = window.confirm(`Delete ${dataset} record ${id}?`);
        if (!confirmed) return;
        await deleteDatasetRecord(token, dataset, id);
        window.alert(`Deleted ${dataset} record ${id}.`);
        if (typeof onChanged === 'function') await onChanged();
        return;
      }

      window.alert('Unsupported command. Use add, edit:<id>, delete:<id>, list');
    } catch (error) {
      window.alert(error?.message || 'Manage action failed.');
    }
  });
}

export function bindSampleCsvDownloads(root = document) {
  root.addEventListener('click', (event) => {
    const button = event.target.closest('[data-download-sample]');
    if (!button) return;

    const dataset = button.dataset.downloadSample;
    const csv = SAMPLE_CSV[dataset];
    if (!csv) {
      window.alert('Sample format not available for this dataset.');
      return;
    }

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${dataset}-sample.csv`;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  });
}
