import Link from 'next/link';

export const metadata = {
  title: 'Payment Cancelled — JobSprint',
};

export default function PaymentCancelledPage() {
  return (
    <main className="feedback-page">
      <h1>Payment Cancelled</h1>
      <p>The checkout window was closed before completing payment.</p>
      <div className="actions">
        <Link className="btn secondary" href="/">
          Return home
        </Link>
      </div>
    </main>
  );
}
