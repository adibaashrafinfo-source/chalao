import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

// Fonts are files inside the app (app/fonts), so pages never call out to Google.
const jakarta = localFont({
  src: [
    { path: "./fonts/plus-jakarta-sans-latin-500-normal.woff2", weight: "500", style: "normal" },
    { path: "./fonts/plus-jakarta-sans-latin-600-normal.woff2", weight: "600", style: "normal" },
    { path: "./fonts/plus-jakarta-sans-latin-700-normal.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-jakarta",
  display: "swap",
});

const inter = localFont({
  src: [
    { path: "./fonts/inter-latin-400-normal.woff2", weight: "400", style: "normal" },
    { path: "./fonts/inter-latin-500-normal.woff2", weight: "500", style: "normal" },
  ],
  variable: "--font-inter",
  display: "swap",
});

// Plus Jakarta Sans and Inter have no Bengali glyphs; this is the fallback for Bangla copy.
const bangla = localFont({
  src: [
    { path: "./fonts/hind-siliguri-bengali-400-normal.woff2", weight: "400", style: "normal" },
    { path: "./fonts/hind-siliguri-bengali-500-normal.woff2", weight: "500", style: "normal" },
    { path: "./fonts/hind-siliguri-bengali-600-normal.woff2", weight: "600", style: "normal" },
    { path: "./fonts/hind-siliguri-bengali-700-normal.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-bangla",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Chalao",
    template: "%s · Chalao",
  },
  description:
    "Orders, customers, inventory, couriers, COD and profit for Facebook & Instagram sellers — in one dashboard.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${jakarta.variable} ${inter.variable} ${bangla.variable}`}>
      <body>{children}</body>
    </html>
  );
}
