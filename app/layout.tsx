import type { Metadata } from "next";
import { Hind_Siliguri, Inter, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-jakarta",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-inter",
  display: "swap",
});

// Plus Jakarta Sans and Inter have no Bengali glyphs; this is the fallback for Bangla copy.
const bangla = Hind_Siliguri({
  subsets: ["bengali"],
  weight: ["400", "500", "600", "700"],
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
