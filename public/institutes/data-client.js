let cache = null;

export async function loadPlacementData(token, { force = false } = {}) {
  if (!force && cache) return cache;

  const response = await fetch('/api/institutes/placement-data', {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    throw new Error('Unable to load institute placement data.');
  }

  cache = await response.json();
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
