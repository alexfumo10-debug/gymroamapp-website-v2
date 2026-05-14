/**
 * Sitemap — generated at build time. Includes the public marketing
 * pages + all 12 city landing pages. Admin and dev paths excluded
 * (also blocked in robots.txt).
 *
 * Available at gymroamapp.com/sitemap.xml — referenced in robots.txt.
 */

import type { MetadataRoute } from "next";
import { CITY_PRESETS } from "@/lib/cityPresets";

const BASE = "https://gymroamapp.com";

export default function sitemap(): MetadataRoute.Sitemap {
  const today = new Date();

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${BASE}/`, lastModified: today, changeFrequency: "weekly", priority: 1.0 },
    { url: `${BASE}/search`, lastModified: today, changeFrequency: "weekly", priority: 0.9 },
    { url: `${BASE}/grow`, lastModified: today, changeFrequency: "monthly", priority: 0.7 },
    { url: `${BASE}/trainer`, lastModified: today, changeFrequency: "monthly", priority: 0.7 },
    { url: `${BASE}/careers`, lastModified: today, changeFrequency: "monthly", priority: 0.5 },
    { url: `${BASE}/join`, lastModified: today, changeFrequency: "monthly", priority: 0.6 },
  ];

  const cityRoutes: MetadataRoute.Sitemap = CITY_PRESETS.map((c) => ({
    url: `${BASE}/gyms-near-me/${c.id}`,
    lastModified: today,
    changeFrequency: "weekly",
    priority: 0.85,
  }));

  return [...staticRoutes, ...cityRoutes];
}
