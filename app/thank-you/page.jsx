import Link from 'next/link';

export const metadata = {
  title: 'Payment Successful — JobSprint',
};

export default function ThankYouPage() {
  return (
    <main className="feedback-page">
      <h1>Payment Successful ✅ Thank you for joining JobSprint!</h1>
      <p>You will receive an email from shantanusriraj@gmail.com with next steps.</p>
      <p>For any support, write to shantanusriraj@gmail.com.</p>
      <div className="actions">
        <Link className="btn primary" href="/">
          Return to home
        </Link>
      </div>
    </main>
  );
}
