import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Money Desk",
  description: "Recorded revenue, invoices and the next three money moves for a small studio.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">
        <a className="skip-link" href="#content">Skip to content</a>
        <main id="content" tabIndex={-1} className="min-h-screen">{children}</main>
      </body>
    </html>
  );
}
