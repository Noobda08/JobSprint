const selectors = {
  storyCard: document.getElementById('story-card'),
  storyBody: document.getElementById('story'),
  sourceChip: document.getElementById('source-chip'),
  clampToggle: document.getElementById('clamp-toggle'),
  errorBanner: document.getElementById('error-banner'),
  retryBtn: document.getElementById('retry-btn'),
  firstTimeNote: document.getElementById('first-time-note'),
  editBtn: document.getElementById('btn-edit'),
  downloadBtn: document.getElementById('btn-download'),
  workspaceBtn: document.getElementById('btn-open-workspace'),
  modal: document.getElementById('persona-modal'),
  modalBackdrop: document.querySelector('#persona-modal .modal-backdrop'),
  modalTextarea: document.getElementById('persona-editor'),
  modalCancel: document.getElementById('modal-cancel'),
  modalSave: document.getElementById('modal-save')
};

const state = {
  persona: null,
  expanded: false,
  loading: true,
  previouslyFocused: null
};

const skeletonMarkup = new Array(4)
  .fill('<div class="skeleton-line"></div>')
  .join('');

async function fetchPersona(url) {
  const response = await fetch(url, {
    headers: { Accept: 'application/json' }
  });
  if (!response.ok) {
    throw new Error(`Failed request: ${response.status}`);
  }
  return response.json();
}

function pickPersona(data) {
  if (!data) return null;
  const params = new URLSearchParams(window.location.search);
  const variant = params.get('variant');

  if (variant && data[variant]) return data[variant];
  if (data.persona) return data.persona;
  if (data.default) return data.default;

  const firstKey = Object.keys(data)[0];
  return data[firstKey];
}

async function loadPersona() {
  state.loading = true;
  setLoading(true);
  hideError();
  try {
    const apiData = await fetchPersona('/api/persona');
    return pickPersona(apiData);
  } catch (apiError) {
    console.warn('Falling back to mock persona.', apiError);
  }

  const mockData = await fetchPersona('./mock_persona.json');
  return pickPersona(mockData);
}

function setLoading(isLoading) {
  selectors.storyCard.classList.toggle('is-loading', isLoading);
  if (isLoading) {
    selectors.storyBody.innerHTML = skeletonMarkup;
    disableStoryActions(true);
  }
}

function disableStoryActions(disabled) {
  selectors.editBtn.disabled = disabled;
  selectors.downloadBtn.disabled = disabled;
}

function hideError() {
  selectors.errorBanner.hidden = true;
}

function showError(message) {
  selectors.errorBanner.hidden = false;
  if (message) {
    selectors.errorBanner.querySelector('span').textContent = message;
  }
  selectors.storyBody.textContent = '';
  disableStoryActions(true);
}

function updateSourceChip(persona) {
  const fromOnboarding = persona?.sources?.from_onboarding_answers;
  selectors.sourceChip.textContent = fromOnboarding
    ? 'From resume + onboarding'
    : 'Based on resume only';
}

function updateFirstTimeNote(persona) {
  const shouldShow = Boolean(persona?.first_time_after_onboarding);
  selectors.firstTimeNote.hidden = !shouldShow;
}

function renderStory(persona) {
  if (!persona) return;
  const text = (persona.persona_text || '').trim();
  const hasText = text.length > 0;
  if (!hasText) {
    selectors.storyBody.textContent = 'No persona story available yet.';
    selectors.clampToggle.hidden = true;
    disableStoryActions(true);
    return;
  }

  disableStoryActions(false);
  const shouldClamp = text.length > 1400;
  const displayText = shouldClamp && !state.expanded
    ? `${text.slice(0, 1400).trimEnd()} …`
    : text;

  selectors.storyBody.textContent = displayText;
  selectors.clampToggle.hidden = !shouldClamp;
  if (shouldClamp) {
    selectors.clampToggle.textContent = state.expanded ? 'Collapse' : 'Expand';
  }
}

function render(persona) {
  if (!persona) return;
  updateSourceChip(persona);
  updateFirstTimeNote(persona);
  renderStory(persona);
  selectors.storyCard.classList.remove('is-loading');
}

async function init() {
  try {
    const persona = await loadPersona();
    if (!persona) {
      throw new Error('Persona payload missing');
    }
    state.persona = persona;
    state.expanded = false;
    render(persona);
  } catch (error) {
    console.error(error);
    showError("Couldn’t load persona.");
  } finally {
    state.loading = false;
    setLoading(false);
  }
}

function handleClampToggle() {
  if (!state.persona) return;
  state.expanded = !state.expanded;
  renderStory(state.persona);
}

function openModal() {
  if (!state.persona) return;
  state.previouslyFocused = document.activeElement;
  selectors.modal.hidden = false;
  selectors.modal.classList.add('open');
  selectors.modal.setAttribute('aria-hidden', 'false');
  selectors.modalTextarea.value = state.persona.persona_text || '';
  trapFocus();
  requestAnimationFrame(() => selectors.modalTextarea.focus());
}

function closeModal() {
  selectors.modal.classList.remove('open');
  selectors.modal.setAttribute('aria-hidden', 'true');
  selectors.modal.hidden = true;
  document.removeEventListener('keydown', handleModalKeydown);
  if (state.previouslyFocused) {
    state.previouslyFocused.focus();
  }
}

function handleModalKeydown(event) {
  if (event.key === 'Escape') {
    event.preventDefault();
    closeModal();
    return;
  }
  if (event.key !== 'Tab') return;

  const focusable = selectors.modal.querySelectorAll(
    'button, [href], textarea, input, select, [tabindex]:not([tabindex="-1"])'
  );
  const focusableArray = Array.from(focusable).filter((el) => !el.hasAttribute('disabled'));
  if (!focusableArray.length) return;

  const first = focusableArray[0];
  const last = focusableArray[focusableArray.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

function trapFocus() {
  document.addEventListener('keydown', handleModalKeydown);
}

function savePersonaEdits() {
  if (!state.persona) return;
  const updatedText = selectors.modalTextarea.value.trim();
  state.persona = { ...state.persona, persona_text: updatedText };
  state.expanded = false;
  renderStory(state.persona);
  closeModal();
}

function downloadPersona() {
  if (!state.persona?.persona_text) return;
  const text = state.persona.persona_text;
  const blob = new Blob([text], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  const userName = state.persona?.user?.name || 'persona';
  anchor.href = url;
  anchor.download = `persona_${userName.toLowerCase().replace(/[^a-z0-9]+/g, '_')}.txt`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function attachEventListeners() {
  selectors.retryBtn.addEventListener('click', () => init());
  selectors.clampToggle.addEventListener('click', handleClampToggle);
  selectors.editBtn.addEventListener('click', openModal);
  selectors.downloadBtn.addEventListener('click', downloadPersona);
  selectors.workspaceBtn.addEventListener('click', () => {
    window.location.href = 'workspace.html';
  });
  selectors.modalBackdrop.addEventListener('click', closeModal);
  selectors.modalCancel.addEventListener('click', closeModal);
  selectors.modalSave.addEventListener('click', savePersonaEdits);
}

attachEventListeners();
init();
