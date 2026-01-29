import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "JobSprint",
  description: "JobSprint App Router shell",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <main>
          <header className="section">
            <div className="badge">Next.js App Router</div>
            <h1>JobSprint App Shell</h1>
            <p>
              This app router scaffolding keeps existing static assets intact and
              prepares admin and tenant routes.
            </p>
          </header>
          {children}
        </main>
      </body>
    </html>
  );
}
