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

export async function loadPlacementData(token, { force = false } = {}) {
  if (!force && cache) return cache;

  const response = await fetch('/api/institutes/placement-data', {
    headers: { Authorization: `Bearer ${token}` },
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    if (payload?.error === 'schema_not_ready') {
      cache = emptyPlacementPayload(payload.message || 'Placement schema setup is pending.');
      return cache;
    }
    throw new Error(payload?.message || 'Unable to load institute placement data.');
  }

  cache = payload;
  return cache;
}

export async function uploadCsvDataset(token, dataset, csvText) {
  const response = await fetch('/api/institutes/placement-data', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ dataset, csv: csvText }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.message || 'CSV upload failed.');
  }

  cache = null;
  return payload;
}
