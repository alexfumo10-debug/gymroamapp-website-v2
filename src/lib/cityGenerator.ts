/**
 * Procedurally generates a set of mock gyms around a given city center.
 * Deterministic — seeded by the city name — so the same city always
 * generates the same gyms.
 *
 * Used for any city not covered by the curated Miami dataset.
 */

import { SearchGym } from "./searchData";

/** Templates per category. {city} and {hood} are interpolated. */
const NAME_TEMPLATES: Record<string, string[]> = {
  Lifting: [
    "{hood} Iron Works",
    "{hood} Strength Co.",
    "Forge {hood}",
    "{city} Lifting Hall",
    "Heavy Hand {hood}",
    "Powerhouse {hood}",
    "{hood} Athletic Club",
  ],
  Pilates: [
    "{hood} Pilates Studio",
    "Reform {hood}",
    "{hood} Movement Lab",
    "Spring {hood}",
    "Pilates Loft {hood}",
    "{city} Pilates Co.",
  ],
  Yoga: [
    "{hood} Yoga Garden",
    "Sunrise Yoga {hood}",
    "{hood} Hot Yoga",
    "Breathe {hood}",
    "Lotus {hood}",
    "{city} Vinyasa",
    "{hood} Yoga Loft",
  ],
  Cycling: [
    "{hood} Cycle Co.",
    "Spin {hood}",
    "{hood} Ride House",
    "Pedal {hood}",
    "Cadence {hood}",
    "{city} Bay Cycle",
  ],
  "Run Club": [
    "{hood} Run Club",
    "{hood} Track Crew",
    "Pace {hood}",
    "{city} Running Group",
    "{hood} Mile Society",
  ],
  Wellness: [
    "{hood} Recovery Lounge",
    "{hood} Cold Plunge",
    "Restore {hood}",
    "{hood} Sauna House",
    "{city} Wellness Spa",
    "{hood} Mobility Lab",
  ],
  Hyrox: [
    "{hood} Hyrox Box",
    "{hood} Hyrox Hall",
    "Hyrox {hood} Lab",
    "Race Ready {hood}",
    "{city} Hyrox Co.",
  ],
};

const DESCRIPTIONS: Record<string, string[]> = {
  Lifting: [
    "Heavy iron, classic powerlifting setup, sled pushes outside.",
    "Modern strength facility with platforms, racks, and sleds.",
    "Industrial space, raw lifting energy. Locals only vibe.",
    "No-frills strength gym. Just iron and chalk.",
  ],
  Pilates: [
    "Reformer-focused boutique studio with small class sizes.",
    "Light-filled studio with classical and contemporary classes.",
    "Reformer + tower combo classes in a gallery-style space.",
    "Small-group reformer studio with personalized form coaching.",
  ],
  Yoga: [
    "Vinyasa, hot yoga, and breathwork in a tropical loft.",
    "Outdoor garden classes. Bring sunscreen and a mat.",
    "Treetop yoga loft with skylight and breeze. Vinyasa & yin.",
    "26 & 2, hot vinyasa, and breathwork. 90-minute classes.",
  ],
  Cycling: [
    "High-energy indoor cycling with DJ-led playlists.",
    "Boutique studio with intervals, climbs, and rhythm rides.",
    "Theme rides and live DJs. Dark room, neon lights.",
    "Studio with leaderboards and resistance tracking.",
  ],
  "Run Club": [
    "Free social runs along the boardwalk. All paces welcome.",
    "Tempo runs, hill repeats, weekend long runs.",
    "Social-first run group with post-run coffee.",
    "Track sessions, pace groups, race prep.",
  ],
  Wellness: [
    "Cold plunges, infrared saunas, and contrast therapy.",
    "Recovery-focused spa: red light, compression, IV drips.",
    "Stretch sessions, massage guns, recovery on demand.",
    "Mobility classes and bodywork. Helps you move better.",
  ],
  Hyrox: [
    "Hyrox-format training: erg, sled, sandbag, run circuits.",
    "Tight community vibe. Great coaching for race prep.",
    "Outdoor turf for sled work. Indoor erg + ski + bike.",
    "45-minute Hyrox-format sessions. Heart rate on screens.",
  ],
};

const AMENITIES: Record<string, string[][]> = {
  Lifting: [["Squat racks", "Sled track", "Sauna"], ["Olympic platforms", "Recovery room", "Towel service"], ["Squat racks", "Deadlift platforms", "Wraps & belts"]],
  Pilates: [["Reformers", "Tower units", "Cadillacs"], ["Reformers", "Mat classes", "Private sessions"], ["Reformers", "Towers", "Spring board"]],
  Yoga: [["Hot yoga", "Mats provided", "Showers"], ["Beach sessions", "Mats provided", "Outdoor"], ["Skylight studio", "Mats", "Tea bar"]],
  Cycling: [["Clip-in shoes", "Towels", "Water"], ["Shoe rental", "Showers", "Smoothie bar"], ["Heart rate", "Towels", "Locker rooms"]],
  "Run Club": [["Group runs", "Pacing groups", "Post-run coffee"], ["Track sessions", "Coaches", "Free coffee"], ["Group runs", "Beach finish", "Free coffee"]],
  Wellness: [["Cold plunge", "Infrared sauna", "Contrast"], ["Red light", "Compression boots", "IV therapy"], ["Stretch", "Massage", "Cryo"]],
  Hyrox: [["Sleds", "Rowers", "Wall balls", "Sandbags"], ["Sleds", "Burpees zone", "Race simulations"], ["Outdoor turf", "Sleds", "Ergs"]],
};

/** Distribution of categories — total 24 gyms per generated city */
const CATEGORY_MIX: Array<[string, number]> = [
  ["Lifting", 4],
  ["Pilates", 3],
  ["Yoga", 4],
  ["Cycling", 3],
  ["Run Club", 2],
  ["Wellness", 4],
  ["Hyrox", 4],
];

const FALLBACK_HOODS = ["Downtown", "North", "South", "East", "West", "Central", "Old Town", "Riverside", "Uptown", "Midtown", "Arts District", "Harbor"];

/**
 * Mulberry32 — small deterministic PRNG. Same seed -> same sequence.
 * Used so refreshing the page doesn't reshuffle the generated gyms.
 */
function makeRng(seed: number) {
  let s = seed >>> 0;
  return function () {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashString(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = (h * 33) ^ s.charCodeAt(i);
  return h >>> 0;
}

export function generateGymsForCity(
  cityName: string,
  centerLat: number,
  centerLng: number,
  neighborhoods?: string[]
): SearchGym[] {
  const rng = makeRng(hashString(cityName.toLowerCase()));
  const hoods = neighborhoods?.length ? neighborhoods : FALLBACK_HOODS;

  const used = new Set<string>();
  const gyms: SearchGym[] = [];

  CATEGORY_MIX.forEach(([type, count]) => {
    const templates = NAME_TEMPLATES[type] || [];
    const descs = DESCRIPTIONS[type] || ["Drop-in friendly local gym."];
    const amens = AMENITIES[type] || [["Showers", "Lockers"]];

    for (let i = 0; i < count; i++) {
      const hood = hoods[Math.floor(rng() * hoods.length)];
      let name = "";
      // Try a few templates until we get a unique name
      for (let attempt = 0; attempt < 5; attempt++) {
        const tmpl = templates[Math.floor(rng() * templates.length)];
        const candidate = tmpl
          .replace("{city}", cityName)
          .replace("{hood}", hood);
        if (!used.has(candidate)) {
          name = candidate;
          break;
        }
      }
      if (!name) name = `${hood} ${type} ${i + 1}`;
      used.add(name);

      // Scatter coordinates within ~3km of center.
      const radiusKm = 1 + rng() * 4; // 1–5 km
      const angle = rng() * Math.PI * 2;
      const dLat = (radiusKm / 111) * Math.cos(angle);
      const dLng =
        (radiusKm / (111 * Math.cos((centerLat * Math.PI) / 180))) *
        Math.sin(angle);

      const rating = 4.4 + rng() * 0.5; // 4.4–4.9
      const reviewCount = 80 + Math.floor(rng() * 500);
      const dropInPrice =
        type === "Run Club" ? 0 : 18 + Math.floor(rng() * 25);

      gyms.push({
        id: `${cityName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${type.toLowerCase().replace(/\s+/g, "-")}-${i}`,
        name,
        type,
        area: hood,
        lat: centerLat + dLat,
        lng: centerLng + dLng,
        rating: Math.round(rating * 10) / 10,
        reviewCount,
        dropInPrice,
        description: descs[Math.floor(rng() * descs.length)],
        amenities: amens[Math.floor(rng() * amens.length)],
        hours: "6:00 AM – 9:00 PM",
        promo: rng() < 0.15 ? "PROMO" : undefined,
        touristPass: rng() < 0.25 ? true : undefined,
      });
    }
  });

  return gyms;
}
