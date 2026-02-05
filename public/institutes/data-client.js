function emptyPlacementPayload(message = '') {
  return {
    drives: [],
    students: [],
    applications: [],
    counselling_sessions: [],
    counselling_notes: [],
    setup_required: true,
    setup_message: message,
  };
}

let cache = null;
const PRELOADED_PLACEMENT_KEY = 'institutes_preloaded_placement';

function readPreloadedPlacement(token) {
  if (!token) return null;
  try {
    const raw = sessionStorage.getItem(PRELOADED_PLACEMENT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed?.token !== token || !parsed?.payload) return null;
    return parsed.payload;
  } catch (_) {
    return null;
  }
}

function writePreloadedPlacement(token, payload) {
  if (!token || !payload) return;
  try {
    sessionStorage.setItem(PRELOADED_PLACEMENT_KEY, JSON.stringify({ token, payload }));
  } catch (_) {
    // ignore session storage write errors
  }
}

function clearPreloadedPlacement() {
  try {
    sessionStorage.removeItem(PRELOADED_PLACEMENT_KEY);
  } catch (_) {
    // ignore session storage clear errors
  }
}

export function primePlacementData(token, payload) {
  if (!token || !payload) return;
  cache = payload;
  writePreloadedPlacement(token, payload);
}

export async function loadPlacementData(token, { force = false } = {}) {
  if (!force && cache) return cache;
  if (!force) {
    const preloaded = readPreloadedPlacement(token);
    if (preloaded) {
      cache = preloaded;
      return cache;
    }
  }

  const response = await fetch('/api/institutes/placement-data', {
    headers: { Authorization: `Bearer ${token}` },
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    if (payload?.error === 'schema_not_ready') {
      cache = emptyPlacementPayload(payload.message || 'Placement schema setup is pending.');
      writePreloadedPlacement(token, cache);
      return cache;
    }
    throw new Error(payload?.message || 'Unable to load institute placement data.');
  }

  cache = payload;
  writePreloadedPlacement(token, cache);
  return cache;
}

async function request(token, method, body) {
  const response = await fetch('/api/institutes/placement-data', {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.message || `${method} failed.`);
  }
  cache = null;
  clearPreloadedPlacement();
  return payload;
}

export async function uploadCsvDataset(token, dataset, csvText) {
  return request(token, 'POST', { dataset, csv: csvText });
}

export async function createDatasetRecord(token, dataset, record) {
  return request(token, 'PUT', { dataset, record });
}

export async function updateDatasetRecord(token, dataset, id, updates) {
  return request(token, 'PATCH', { dataset, id, updates });
}

export async function deleteDatasetRecord(token, dataset, id) {
  return request(token, 'DELETE', { dataset, id });
}
