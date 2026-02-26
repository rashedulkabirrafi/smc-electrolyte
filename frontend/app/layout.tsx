import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "SMC Heatwave Risk",
  description: "Bangladesh heatwave and health-risk intelligence",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <header className="top-nav">
          <div className="top-nav-inner">
            <Link href="/" className="brand-link">
              SMC Electrolyte
            </Link>
            <nav className="menu-links">
              <Link href="/">Dashboard</Link>
              <Link href="/incidents">Incidents</Link>
            </nav>
          </div>
        </header>
        {children}
      </body>
    </html>
  );
}
