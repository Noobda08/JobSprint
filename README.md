# JobSprint

Marketing site for JobSprint with integrated Razorpay checkout.

## Getting Started

```bash
npm install
npm run dev
```

## Payments (Razorpay)

1. Copy `.env.example` to `.env.local` and fill in your live keys:
   ```
   RAZORPAY_KEY_ID=your_live_key
   RAZORPAY_KEY_SECRET=your_live_secret
   NEXT_PUBLIC_RAZORPAY_KEY_ID=your_live_key
   ```
2. Restart the dev server after setting environment variables.
3. The pricing CTA (`#pricing > div > div:nth-child(1) > div.price-cta > a`) opens Razorpay Checkout, creates an order via `/api/create-order`, and verifies the payment with `/api/verify`.
4. Successful payments redirect to `/thank-you`; failures go to `/payment-failed`; dismissed checkouts go to `/payment-cancelled`.

Deployments on Vercel will read the same environment variables from the project settings.
