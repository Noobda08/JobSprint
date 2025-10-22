import Link from 'next/link';

export const metadata = {
  title: 'Payment Failed — JobSprint',
};

export default function PaymentFailedPage() {
  return (
    <main className="feedback-page">
      <h1>Payment Failed ❌</h1>
      <p>We couldn’t confirm your payment. Please try again.</p>
      <div className="actions">
        <Link className="btn primary" href="/">
          Retry payment
        </Link>
      </div>
    </main>
  );
}
