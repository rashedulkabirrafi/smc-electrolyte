import type { Metadata } from "next";
import { Inter, Outfit } from "next/font/google";
import "leaflet/dist/leaflet.css";
import Navbar from "../components/Navbar";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const outfit = Outfit({ subsets: ["latin"], variable: "--font-outfit" });

export const metadata: Metadata = {
  title: "Bangladesh Heatwave / Heatstroke Monitor",
  description: "Simple 2-page monitor for district boundaries and heatstroke incidents",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${outfit.variable}`}>
      <body className="font-sans">
        <Navbar />
        {children}
      </body>
    </html>
  );
}
