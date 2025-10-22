# JobSprint

Marketing site for JobSprint with integrated Razorpay checkout and Vercel serverless endpoints.

## Getting Started

1. Install the lone dependency used by the Vercel serverless functions:
   ```bash
   npm install
   ```
2. Run the project locally with the Vercel CLI so the API routes are available:
   ```bash
   npx vercel dev
   ```
   The static site will be served at `http://localhost:3000` with live Razorpay order + verification routes.

## Payments (Razorpay)

1. Copy `.env.example` to `.env` (or configure the variables directly in Vercel) and supply your live credentials:
   ```
   RAZORPAY_KEY_ID=your_live_key
   RAZORPAY_KEY_SECRET=your_live_secret
   NEXT_PUBLIC_RAZORPAY_KEY_ID=your_live_key
   ```
2. The pricing CTA (`#pricing > div > div:nth-child(1) > div.price-cta > a`) triggers the Razorpay Checkout experience by:
   - Loading the Razorpay SDK on demand (`razorpay.js`).
   - Fetching the publishable key from `/api/config` so the client never embeds secrets in the HTML.
   - Creating an order from `/api/create-order` (amount `99900`, currency `INR`).
   - Passing the resulting order id + key into `window.Razorpay`.
3. On payment completion, the front end calls `/api/verify` to validate the signature before redirecting to:
   - `/thank-you` on success.
   - `/payment-failed` if verification fails or the API throws.
   - `/payment-cancelled` when the Razorpay modal is dismissed.
4. Set the same environment variables in your Vercel project settings so deployments can read them securely.

For support or deployment tweaks, update the environment variables and redeploy via Vercel.
