(function () {
  const activeToasts = new Map();
  let toastCounter = 0;

  function ensureContainer() {
    let container = document.querySelector('.toast-container');
    if (!container) {
      container = document.createElement('div');
      container.className = 'toast-container';
      container.setAttribute('aria-live', 'polite');
      document.body.appendChild(container);
    }
    return container;
  }

  function getIconForVariant(variant) {
    switch (variant) {
      case 'success':
        return '✅';
      case 'danger':
        return '⚠️';
      case 'warning':
        return '⚠️';
      case 'progress':
        return null;
      default:
        return 'ℹ️';
    }
  }

  function dismissToast(id) {
    const toastEntry = activeToasts.get(id);
    if (!toastEntry) return;
    const { element, timer } = toastEntry;
    if (timer) {
      clearTimeout(timer);
    }
    activeToasts.delete(id);
    requestAnimationFrame(() => {
      element.classList.remove('show');
      const removeAfter = () => {
        element.removeEventListener('transitionend', removeAfter);
        if (element.parentElement) {
          element.parentElement.removeChild(element);
        }
      };
      element.addEventListener('transitionend', removeAfter);
      element.setAttribute('aria-hidden', 'true');
    });
  }

  function showToast(message, options = {}) {
    const {
      variant = 'info',
      duration = 4200,
      dismissible = true,
      spinner = false,
    } = options;

    const container = ensureContainer();
    const id = `toast-${Date.now()}-${++toastCounter}`;
    const toast = document.createElement('div');
    toast.className = 'toast-message';
    toast.dataset.variant = variant;
    toast.setAttribute('role', variant === 'danger' ? 'alert' : 'status');
    toast.setAttribute('aria-live', variant === 'danger' ? 'assertive' : 'polite');
    toast.dataset.toastId = id;

    const icon = getIconForVariant(variant);
    if (spinner) {
      const spin = document.createElement('span');
      spin.className = 'toast-spinner';
      toast.appendChild(spin);
    } else if (icon) {
      const iconEl = document.createElement('span');
      iconEl.className = 'toast-message__icon';
      iconEl.textContent = icon;
      toast.appendChild(iconEl);
    }

    const body = document.createElement('div');
    body.className = 'toast-message__body';
    body.textContent = message;
    toast.appendChild(body);

    if (dismissible && !spinner) {
      const closeBtn = document.createElement('button');
      closeBtn.type = 'button';
      closeBtn.className = 'toast-message__close';
      closeBtn.setAttribute('aria-label', 'Close notification');
      closeBtn.innerHTML = '&times;';
      closeBtn.addEventListener('click', () => dismissToast(id));
      toast.appendChild(closeBtn);
    }

    container.appendChild(toast);
    requestAnimationFrame(() => {
      toast.classList.add('show');
    });

    let timer = null;
    if (!spinner && duration > 0) {
      timer = setTimeout(() => dismissToast(id), duration);
    }

    activeToasts.set(id, { element: toast, timer, body });

    return {
      id,
      dismiss: () => dismissToast(id),
      update: (nextMessage) => {
        if (typeof nextMessage === 'string') {
          body.textContent = nextMessage;
        }
      }
    };
  }

  function showLoadingToast(message, options = {}) {
    return showToast(message, {
      variant: options.variant || 'progress',
      duration: 0,
      dismissible: false,
      spinner: true,
    });
  }

  async function wrapAsync(promise, { loading = 'Working...', success, error, successVariant = 'success' } = {}) {
    const loadingToast = showLoadingToast(loading);
    try {
      const result = await promise;
      loadingToast.dismiss();
      if (success) {
        const successMessage = typeof success === 'function' ? success(result) : success;
        if (successMessage) {
          showToast(successMessage, { variant: successVariant });
        }
      }
      return result;
    } catch (err) {
      loadingToast.dismiss();
      const errorMessage = typeof error === 'function' ? error(err) : (error || err?.message || 'Something went wrong.');
      showToast(errorMessage, { variant: 'danger' });
      throw err;
    }
  }

  window.JobSprintUI = {
    showToast,
    dismissToast,
    showLoadingToast,
    wrapAsync,
  };
})();
