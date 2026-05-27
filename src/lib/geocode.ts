/**
 * Free city geocoding via Nominatim (OpenStreetMap). No API key, no
 * billing — just a 1 req/sec rate limit per usage policy.
 *
 * Results are cached in localStorage so repeat lookups are instant
 * and we stay well under any rate limits.
 */

export interface GeocodeResult {
  lat: number;
  lng: number;
  /** Trimmed display: "Atlanta" */
  shortName: string;
  /** Full display: "Atlanta, Fulton County, Georgia, United States" */
  fullName: string;
}

const CACHE_KEY = "gr_city_geocode_v1";
const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

interface CacheEntry {
  result: GeocodeResult;
  cachedAt: number;
}

function loadCache(): Record<string, CacheEntry> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY) || "{}");
  } catch {
    return {};
  }
}

function saveCache(cache: Record<string, CacheEntry>) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {
    /* localStorage may be full or unavailable — just skip */
  }
}

export async function geocodeCity(
  query: string
): Promise<GeocodeResult | null> {
  const key = query.trim().toLowerCase();
  if (!key) return null;

  // Cache hit
  const cache = loadCache();
  const hit = cache[key];
  if (hit && Date.now() - hit.cachedAt < CACHE_TTL_MS) {
    return hit.result;
  }

  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1&addressdetails=1`;
    const res = await fetch(url, {
      headers: { "Accept-Language": "en" },
    });
    if (!res.ok) return null;
    const data: Array<{
      lat: string;
      lon: string;
      display_name: string;
      address?: { city?: string; town?: string; village?: string; state?: string; country?: string };
    }> = await res.json();
    if (!data.length) return null;
    const r = data[0];
    const cityName =
      r.address?.city || r.address?.town || r.address?.village || r.display_name.split(",")[0].trim();
    const result: GeocodeResult = {
      lat: parseFloat(r.lat),
      lng: parseFloat(r.lon),
      shortName: cityName,
      fullName: r.display_name,
    };
    cache[key] = { result, cachedAt: Date.now() };
    saveCache(cache);
    return result;
  } catch {
    return null;
  }
}
