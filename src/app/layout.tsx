import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
});

export const metadata: Metadata = {
  title: "GymRoam — Find Your Sweat. Anywhere.",
  description: "GymRoam helps you find gyms, fitness studios, and wellness centers wherever you travel. Search any city, get directions, and never miss a workout.",
  keywords: "gym finder, travel fitness, gym near me, workout travel, fitness app, yoga studio finder",
  openGraph: {
    title: "GymRoam — Find Your Sweat. Anywhere.",
    description: "Search any city and instantly discover nearby gyms with photos, directions, and details.",
    type: "website",
    images: ["/og-image.png"],
  },
  twitter: {
    card: "summary_large_image",
  },
  icons: {
    icon: "/favicon.png",
    apple: "/apple-touch-icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={inter.className}>
      <body>{children}</body>
    </html>
  );
}
