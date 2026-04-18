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
    description: "Search any city and instantly discover nearby gyms with directions and details.",
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
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "GymRoam",
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={inter.className}>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover" />
        <meta name="format-detection" content="telephone=no" />
      </head>
      <body>{children}</body>
    </html>
  );
}
