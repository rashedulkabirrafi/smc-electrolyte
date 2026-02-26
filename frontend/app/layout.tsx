import type { Metadata } from "next";
import { Manrope } from "next/font/google";
import Link from "next/link";
import ScrollEffects from "../components/scroll-effects";
import "./globals.css";

const manrope = Manrope({
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
    <html lang="en" className={manrope.className}>
      <body>
        <ScrollEffects />
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
