'use client';

import { useEffect, useState } from 'react';
import Script from 'next/script';

const CTA_SELECTOR = '#pricing > div > div:nth-child(1) > div.price-cta > a';

function redirectTo(path) {
  window.location.href = path;
}

export default function RazorpayCheckoutBinder() {
  const [scriptLoaded, setScriptLoaded] = useState(false);

  useEffect(() => {
    const cta = document.querySelector(CTA_SELECTOR);
    if (!cta) {
      return undefined;
    }

    const handleClick = async (event) => {
      event.preventDefault();

      try {
        if (!window.Razorpay) {
          throw new Error('Razorpay SDK failed to load');
        }

        const orderResponse = await fetch('/api/create-order', {
          method: 'POST',
        });

        if (!orderResponse.ok) {
          throw new Error('Failed to create Razorpay order');
        }

        const order = await orderResponse.json();

        if (!order?.orderId || !order?.amount || !order?.currency) {
          throw new Error('Invalid order response');
        }

        const key = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;

        if (!key) {
          throw new Error('Missing Razorpay key');
        }

        const options = {
          key,
          order_id: order.orderId,
          amount: order.amount,
          currency: order.currency,
          name: 'JobSprint',
          description: '90-Day Job Hunt Sprint',
          image: '/logo.png',
          theme: { color: '#0b5cff' },
          handler: async (response) => {
            try {
              const verifyResponse = await fetch('/api/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(response),
              });

              if (!verifyResponse.ok) {
                throw new Error('Verification failed');
              }

              const verify = await verifyResponse.json();
              redirectTo(verify.ok ? '/thank-you' : '/payment-failed');
            } catch (error) {
              console.error('Error verifying payment', error);
              redirectTo('/payment-failed');
            }
          },
          modal: {
            ondismiss: () => redirectTo('/payment-cancelled'),
          },
        };

        const rzp = new window.Razorpay(options);
        rzp.on('payment.failed', () => {
          redirectTo('/payment-failed');
        });
        rzp.open();
      } catch (error) {
        console.error('Error triggering Razorpay checkout', error);
        redirectTo('/payment-failed');
      }
    };

    cta.addEventListener('click', handleClick);

    return () => {
      cta.removeEventListener('click', handleClick);
    };
  }, [scriptLoaded]);

  return (
    <Script
      src="https://checkout.razorpay.com/v1/checkout.js"
      strategy="afterInteractive"
      onLoad={() => setScriptLoaded(true)}
      onError={() => {
        console.error('Failed to load Razorpay SDK');
      }}
    />
  );
}
