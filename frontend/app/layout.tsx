import type { Metadata } from "next";
import "leaflet/dist/leaflet.css";
import Navbar from "../components/Navbar";
import "./globals.css";

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
    <html lang="en">
      <body>
        <Navbar />
        {children}
      </body>
    </html>
  );
}
