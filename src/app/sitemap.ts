/**
 * Sitemap — generated at build time. Includes the public marketing
 * pages, the 12 city landing pages, and the public legal pages.
 * Admin and API paths are excluded here and in robots.txt.
 *
 * lastModified is hand-curated per page rather than always "today"
 * so Google can distinguish recently-changed pages from stable ones
 * when scheduling recrawls. Bump these when you make a material
 * change to a page's content.
 *
 * Available at gymroamapp.com/sitemap.xml — referenced in robots.txt.
 */

import type { MetadataRoute } from "next";
import { CITY_PRESETS } from "@/lib/cityPresets";

const BASE = "https://gymroamapp.com";

// Bump a date when its page's content materially changes.
const LAST_MODIFIED = {
  home: new Date("2026-05-01"),
  search: new Date("2026-05-01"),
  grow: new Date("2026-04-15"),
  trainer: new Date("2026-04-15"),
  careers: new Date("2026-05-01"),
  feedback: new Date("2026-05-16"),
  support: new Date("2026-05-26"),
  privacy: new Date("2026-03-27"),
  terms: new Date("2026-05-16"),
  cityPages: new Date("2026-05-01"),
} as const;

export default function sitemap(): MetadataRoute.Sitemap {
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${BASE}/`, lastModified: LAST_MODIFIED.home, changeFrequency: "weekly", priority: 1.0 },
    { url: `${BASE}/search`, lastModified: LAST_MODIFIED.search, changeFrequency: "weekly", priority: 0.9 },
    { url: `${BASE}/grow`, lastModified: LAST_MODIFIED.grow, changeFrequency: "monthly", priority: 0.7 },
    { url: `${BASE}/trainer`, lastModified: LAST_MODIFIED.trainer, changeFrequency: "monthly", priority: 0.7 },
    { url: `${BASE}/careers`, lastModified: LAST_MODIFIED.careers, changeFrequency: "monthly", priority: 0.5 },
    // /join is intentionally excluded — it's now a 308 permanent
    // redirect to the App Store, kept alive only for old inbound links.
    { url: `${BASE}/feedback`, lastModified: LAST_MODIFIED.feedback, changeFrequency: "weekly", priority: 0.5 },
    { url: `${BASE}/support`, lastModified: LAST_MODIFIED.support, changeFrequency: "monthly", priority: 0.5 },
    { url: `${BASE}/privacy`, lastModified: LAST_MODIFIED.privacy, changeFrequency: "yearly", priority: 0.3 },
    { url: `${BASE}/terms`, lastModified: LAST_MODIFIED.terms, changeFrequency: "yearly", priority: 0.3 },
  ];

  const cityRoutes: MetadataRoute.Sitemap = CITY_PRESETS.map((c) => ({
    url: `${BASE}/gyms-near-me/${c.id}`,
    lastModified: LAST_MODIFIED.cityPages,
    changeFrequency: "weekly",
    priority: 0.85,
  }));

  return [...staticRoutes, ...cityRoutes];
}
