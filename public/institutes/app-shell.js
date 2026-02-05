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
    if (logo) {
      el.innerHTML = `<img src="${logo}" alt="${name} logo">`;
    } else {
      el.textContent = name.slice(0, 2).toUpperCase();
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
