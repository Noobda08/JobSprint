const ACCORDION_STATE_KEY = 'persona-accordion-state-v1';

const selectors = {
  name: document.getElementById('persona-name'),
  role: document.getElementById('persona-role'),
  seniority: document.getElementById('persona-seniority'),
  tagline: document.getElementById('persona-tagline'),
  experience: document.getElementById('persona-experience'),
  location: document.getElementById('persona-location'),
  focus: document.getElementById('persona-focus'),
  summary: document.getElementById('persona-summary'),
  summaryHint: document.getElementById('summary-hint'),
  badgeList: document.getElementById('badge-list'),
  templates: {
    list: document.getElementById('accordion-list-template'),
    badge: document.getElementById('badge-template')
  },
  accordions: Array.from(document.querySelectorAll('[data-accordion]'))
};

const loadingContainers = Array.from(document.querySelectorAll('[data-skeleton]'));

const buttons = {
  regenerate: document.getElementById('btn-regenerate'),
  download: document.getElementById('btn-download'),
  share: document.getElementById('btn-share'),
  navBack: document.getElementById('nav-back'),
  navWorkspace: document.getElementById('nav-workspace')
};

const modal = document.getElementById('regenerate-modal');

function setLoading(isLoading) {
  loadingContainers.forEach((container) => {
    container.classList.toggle('is-loading', isLoading);
    container.querySelectorAll('.skeleton-text').forEach((node) => {
      node.classList.toggle('skeleton-text', isLoading);
    });
  });
}

function setError(message) {
  selectors.summary.textContent = message;
  selectors.summary.setAttribute('data-empty', 'true');
}

async function fetchPersonaFrom(url) {
  const response = await fetch(url, {
    headers: {
      Accept: 'application/json'
    }
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch persona from ${url}`);
  }
  return response.json();
}

function chooseVariant(data) {
  const params = new URLSearchParams(window.location.search);
  const hash = window.location.hash.replace('#', '');
  const variantKey = params.get('variant') || (hash ? hash : null);

  if (!data) return null;
  if (variantKey && typeof data === 'object') {
    if (variantKey in data) {
      return data[variantKey];
    }
    if (data.variants && variantKey in data.variants) {
      return data.variants[variantKey];
    }
  }
  if ('persona' in data) return data.persona;
  if ('default' in data) return data.default;
  if (Array.isArray(data)) return data[0];
  return data;
}

async function loadPersonaData() {
  try {
    const apiData = await fetchPersonaFrom('/api/persona');
    return chooseVariant(apiData);
  } catch (error) {
    console.warn('Falling back to mock persona:', error);
  }

  try {
    const mockData = await fetchPersonaFrom('./mock_persona.json');
    return chooseVariant(mockData);
  } catch (error) {
    console.error('Unable to load persona data.', error);
    throw error;
  }
}

function ensureArray(value) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function createList(items) {
  const template = selectors.templates.list.content.firstElementChild.cloneNode(false);
  items.forEach((item) => {
    const li = document.createElement('li');
    li.textContent = item;
    template.appendChild(li);
  });
  return template;
}

function populateHero(persona) {
  selectors.name.textContent = persona.name ?? '—';
  selectors.role.textContent = persona.current_role ?? persona.target_role ?? '';
  selectors.seniority.textContent = persona.seniority ?? persona.level ?? '';
  selectors.seniority.toggleAttribute('hidden', !selectors.seniority.textContent);
  selectors.tagline.textContent = persona.tagline ?? persona.value_proposition ?? '';
  selectors.tagline.toggleAttribute('data-empty', !selectors.tagline.textContent);
  selectors.experience.textContent = persona.experience ?? persona.years_of_experience ?? 'Unknown';
  selectors.location.textContent = persona.location ?? persona.region ?? '—';
  selectors.focus.textContent = persona.focus_area ?? ensureArray(persona.focus_areas).join(', ');
  if (!selectors.focus.textContent) {
    selectors.focus.textContent = '—';
  }
}

function populateSummary(persona) {
  const resumeOnly = persona?.sources?.from_onboarding_answers === false;
  const hint = resumeOnly
    ? 'Based on resume data only — add onboarding answers for richer insight.'
    : 'Includes onboarding reflections and resume signals.';
  selectors.summaryHint.textContent = hint;
  selectors.summary.textContent = persona.summary ?? persona.narrative ?? '';
  selectors.summary.toggleAttribute('data-empty', !selectors.summary.textContent);
}

function populateBadges(persona) {
  selectors.badgeList.textContent = '';
  const badges = ensureArray(persona.badges ?? persona.highlights);
  if (!badges.length) {
    selectors.badgeList.setAttribute('data-empty', 'true');
    selectors.badgeList.textContent = 'No highlights yet.';
    return;
  }
  selectors.badgeList.removeAttribute('data-empty');
  badges.forEach((badge) => {
    const el = selectors.templates.badge.content.firstElementChild.cloneNode(true);
    el.textContent = badge;
    selectors.badgeList.appendChild(el);
  });
}

function renderAccordionContent(target, value) {
  const container = document.getElementById(`${target}-body`);
  const preview = document.querySelector(`[data-preview="${target}"]`);
  container.textContent = '';

  const paragraphs = ensureArray(value);
  if (!paragraphs.length) {
    container.setAttribute('data-empty', 'true');
    container.textContent = 'No insight available yet.';
    preview.textContent = 'No insight available yet.';
    return;
  }

  container.removeAttribute('data-empty');
  preview.textContent = paragraphs[0];

  const listItems = paragraphs.filter((item) => typeof item === 'string');
  if (listItems.length > 1) {
    const list = createList(listItems);
    container.appendChild(list);
  } else {
    const paragraph = document.createElement('p');
    paragraph.textContent = listItems[0];
    container.appendChild(paragraph);
  }
}

function applyResumeOnlyHint(container, resumeOnly) {
  if (!container) return;
  let hint = container.querySelector('.resume-only-hint');
  if (!resumeOnly) {
    hint?.remove();
    return;
  }
  if (!hint) {
    hint = document.createElement('p');
    hint.className = 'resume-only-hint';
    hint.textContent = 'Insight inferred from resume content — confirm during kickoff.';
    container.prepend(hint);
  }
}

function populateAccordions(persona) {
  const resumeOnly = persona?.sources?.from_onboarding_answers === false;
  const sections = [
    ['journey', persona.career_journey ?? persona.journey],
    ['strengths', persona.strengths],
    ['effortless', persona.effortless ?? persona.natural_abilities],
    ['next', persona.next_steps ?? persona.recommendations]
  ];

  sections.forEach(([key, value]) => {
    renderAccordionContent(key, value);
    const panel = document.getElementById(`panel-${key}`);
    applyResumeOnlyHint(panel, resumeOnly);
  });
}

function hydrateAccordions() {
  const state = sessionStorage.getItem(ACCORDION_STATE_KEY);
  let saved = {};
  if (state) {
    try {
      saved = JSON.parse(state) ?? {};
    } catch (error) {
      console.warn('Clearing corrupt accordion state', error);
      sessionStorage.removeItem(ACCORDION_STATE_KEY);
    }
  }

  selectors.accordions.forEach((section) => {
    const trigger = section.querySelector('.accordion-trigger');
    const panel = section.querySelector('.accordion-panel');
    const key = section.id;

    function setExpanded(value) {
      trigger.setAttribute('aria-expanded', String(value));
      panel.hidden = !value;
    }

    const initial = saved[key];
    if (typeof initial === 'boolean') {
      setExpanded(initial);
    }

    trigger.addEventListener('click', () => {
      const expanded = trigger.getAttribute('aria-expanded') === 'true';
      setExpanded(!expanded);
      saved[key] = !expanded;
      sessionStorage.setItem(ACCORDION_STATE_KEY, JSON.stringify(saved));
    });
  });
}

function wireNavigation(persona) {
  buttons.navBack?.addEventListener('click', () => {
    if (window.history.length > 1) {
      window.history.back();
    } else {
      window.location.href = 'workspace.html';
    }
  });

  buttons.navWorkspace?.addEventListener('click', () => {
    window.location.href = 'workspace.html';
  });

  buttons.download?.addEventListener('click', () => {
    const target = persona?.download_url || persona?.document_url;
    if (target) {
      window.open(target, '_blank', 'noopener');
    } else {
      alert('A downloadable persona will be available once generated.');
    }
  });

  buttons.share?.addEventListener('click', async () => {
    const shareData = {
      title: 'Sprint Persona',
      text: `Persona for ${persona?.name ?? 'candidate'}`,
      url: window.location.href
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch (err) {
        if (err?.name !== 'AbortError') {
          console.warn('Share failed', err);
        }
      }
      return;
    }

    try {
      await navigator.clipboard.writeText(window.location.href);
      alert('Link copied to clipboard');
    } catch (err) {
      console.warn('Clipboard unavailable', err);
      alert('Unable to copy link automatically.');
    }
  });
}

function wireRegenerate(persona) {
  if (!buttons.regenerate) return;

  const showModal = () => {
    if (typeof modal?.showModal === 'function') {
      modal.showModal();
    } else {
      const confirmRegenerate = window.confirm('Regenerate persona?');
      if (confirmRegenerate) {
        triggerRegeneration(persona);
      }
    }
  };

  const onClose = (event) => {
    if (event.target.value === 'confirm') {
      triggerRegeneration(persona);
    }
  };

  modal?.addEventListener('close', onClose);
  buttons.regenerate.addEventListener('click', showModal);
}

function triggerRegeneration(persona) {
  console.info('Persona regeneration triggered for', persona?.id ?? persona?.name ?? 'unknown persona');
  sessionStorage.removeItem(ACCORDION_STATE_KEY);
  window.dispatchEvent(new CustomEvent('persona:regenerate', { detail: persona }));
}

function removeLoadingState() {
  loadingContainers.forEach((container) => container.classList.remove('is-loading'));
}

function handleError(err) {
  setError('We could not load this persona right now. Please try again.');
  document.body.classList.add('persona-error');
  console.error(err);
}

function hydratePage(persona) {
  if (!persona) {
    throw new Error('Persona payload is empty.');
  }
  populateHero(persona);
  populateSummary(persona);
  populateBadges(persona);
  populateAccordions(persona);
  wireNavigation(persona);
  wireRegenerate(persona);
  removeLoadingState();
}

(async function init() {
  setLoading(true);
  hydrateAccordions();
  try {
    const persona = await loadPersonaData();
    hydratePage(persona);
  } catch (err) {
    handleError(err);
  } finally {
    setLoading(false);
  }
})();
