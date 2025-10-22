(function () {
  const CTA_SELECTOR = '#pricing > div > div:nth-child(1) > div.price-cta > a';
  const SUCCESS_URL = '/thank-you';
  const FAILURE_URL = '/payment-failed';
  const CANCELLED_URL = '/payment-cancelled';

  let scriptPromise;

  function redirect(path) {
    window.location.href = path;
  }

  function loadRazorpayScript() {
    if (window.Razorpay) {
      return Promise.resolve();
    }

    if (!scriptPromise) {
      scriptPromise = new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://checkout.razorpay.com/v1/checkout.js';
        script.async = true;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error('Failed to load Razorpay SDK'));
        document.head.appendChild(script);
      });
    }

    return scriptPromise;
  }

  async function parseJsonResponse(response) {
    if (!response.ok) {
      throw new Error('Request failed');
    }
    return response.json();
  }

  async function fetchConfig() {
    const response = await fetch('/api/config');
    return parseJsonResponse(response);
  }

  async function createOrder() {
    const response = await fetch('/api/create-order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    return parseJsonResponse(response);
  }

  async function verifyPayment(payload) {
    const response = await fetch('/api/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return parseJsonResponse(response);
  }

  function setBusy(cta, busy) {
    if (!cta) {
      return;
    }

    if (busy) {
      cta.setAttribute('aria-disabled', 'true');
      cta.classList.add('is-busy');
    } else {
      cta.removeAttribute('aria-disabled');
      cta.classList.remove('is-busy');
    }
  }

  async function startCheckout(event) {
    event.preventDefault();
    const cta = event.currentTarget;

    try {
      setBusy(cta, true);
      await loadRazorpayScript();

      const [config, order] = await Promise.all([fetchConfig(), createOrder()]);

      if (!config?.key) {
        throw new Error('Missing Razorpay key');
      }

      if (!order?.orderId || !order?.amount || !order?.currency) {
        throw new Error('Invalid order payload');
      }

      const options = {
        key: config.key,
        order_id: order.orderId,
        amount: order.amount,
        currency: order.currency,
        name: 'JobSprint',
        description: '90-Day Job Hunt Sprint',
        image: '/logo.png',
        theme: { color: '#0b5cff' },
        handler: async function (response) {
          try {
            const verification = await verifyPayment(response);
            redirect(verification.ok ? SUCCESS_URL : FAILURE_URL);
          } catch (error) {
            console.error('Error verifying payment', error);
            redirect(FAILURE_URL);
          }
        },
        modal: {
          ondismiss: function () {
            redirect(CANCELLED_URL);
          },
        },
      };

      const razorpay = new window.Razorpay(options);
      razorpay.on('payment.failed', function () {
        redirect(FAILURE_URL);
      });
      razorpay.open();
    } catch (error) {
      console.error('Unable to start Razorpay checkout', error);
      redirect(FAILURE_URL);
    } finally {
      setBusy(cta, false);
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    const cta = document.querySelector(CTA_SELECTOR);

    if (!cta) {
      console.warn('Razorpay CTA not found for selector', CTA_SELECTOR);
      return;
    }

    cta.addEventListener('click', startCheckout);
  });
})();
