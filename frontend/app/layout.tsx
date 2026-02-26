import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "SMC Heatwave Risk Dashboard",
  description: "Bangladesh heatwave monitoring and health-risk intelligence platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={inter.className}>
      <body>
        <header className="top-nav">
          <div className="top-nav-inner">
            <Link href="/" className="brand-link">
              SMC Heatwave
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
