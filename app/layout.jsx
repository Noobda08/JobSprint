import './globals.css';

export const metadata = {
  title: 'JobSprint — Find your next job with structure and confidence',
  description:
    'JobSprint helps you stay consistent, focused, and ready — turning your job hunt into a clear 90-day journey with visible progress.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
