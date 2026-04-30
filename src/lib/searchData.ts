/**
 * Mock gym dataset for the /search experience.
 *
 * NOT real partnerships — names are fictional, but neighborhoods and
 * coordinates are real Miami spots. Used as a pre-launch placeholder
 * so visitors can preview the search experience.
 *
 * Replace with real Firestore-backed gym data once partners start
 * subscribing via /grow.
 */

export interface SearchGym {
  id: string;
  name: string;
  type: string;
  area: string;
  lat: number;
  lng: number;
  rating: number;
  reviewCount: number;
  dropInPrice: number;
  description: string;
  amenities: string[];
  hours: string;
  /** Optional badge — shows the red PROMO ribbon on the card thumbnail */
  promo?: string;
  /** Optional tourist-day-pass flag — shown on the gym card */
  touristPass?: boolean;
}

export const SEARCH_GYMS: SearchGym[] = [
  {
    id: "iron-forge",
    name: "Iron Forge Athletic Club",
    type: "Lifting",
    area: "South Beach",
    lat: 25.7825, lng: -80.134,
    rating: 4.8, reviewCount: 412, dropInPrice: 25,
    description: "Heavy iron, classic powerlifting setup, sled pushes outside.",
    amenities: ["Squat racks", "Sled track", "Sauna"],
    hours: "5:00 AM – 11:00 PM",
    promo: "PROMO",
    touristPass: true,
  },
  {
    id: "brickell-strong",
    name: "Brickell Strong",
    type: "Lifting",
    area: "Brickell",
    lat: 25.7642, lng: -80.193,
    rating: 4.6, reviewCount: 287, dropInPrice: 30,
    description: "Modern strength facility with platforms, racks, and sleds.",
    amenities: ["Olympic platforms", "Recovery room", "Towel service"],
    hours: "5:00 AM – 12:00 AM",
  },
  {
    id: "wynwood-lifting",
    name: "Wynwood Lifting Hall",
    type: "Lifting",
    area: "Wynwood",
    lat: 25.8015, lng: -80.1968,
    rating: 4.7, reviewCount: 198, dropInPrice: 22,
    description: "Industrial space, raw lifting energy. Locals only vibe.",
    amenities: ["Squat racks", "Deadlift platforms", "Wraps & belts"],
    hours: "6:00 AM – 10:00 PM",
  },
  {
    id: "brickell-pilates",
    name: "Brickell Pilates Lab",
    type: "Pilates",
    area: "Brickell",
    lat: 25.7651, lng: -80.1922,
    rating: 4.9, reviewCount: 521, dropInPrice: 38,
    description: "Reformer-focused boutique studio with small class sizes.",
    amenities: ["Reformers", "Tower units", "Cadillacs"],
    hours: "6:00 AM – 9:00 PM",
  },
  {
    id: "coconut-grove-pilates",
    name: "Coconut Grove Pilates",
    type: "Pilates",
    area: "Coconut Grove",
    lat: 25.7282, lng: -80.2433,
    rating: 4.7, reviewCount: 234, dropInPrice: 35,
    description: "Light-filled studio with classical and contemporary classes.",
    amenities: ["Reformers", "Mat classes", "Private sessions"],
    hours: "7:00 AM – 8:00 PM",
  },
  {
    id: "wynwood-wellness",
    name: "Wynwood Wellness Studio",
    type: "Yoga",
    area: "Wynwood",
    lat: 25.801, lng: -80.199,
    rating: 4.8, reviewCount: 367, dropInPrice: 22,
    description: "Vinyasa, hot yoga, and breathwork in a tropical loft.",
    amenities: ["Hot yoga", "Mats provided", "Showers"],
    hours: "6:00 AM – 9:30 PM",
    promo: "PROMO",
  },
  {
    id: "sunrise-yoga",
    name: "Sunrise Yoga Co.",
    type: "Yoga",
    area: "South Beach",
    lat: 25.7855, lng: -80.131,
    rating: 4.9, reviewCount: 612, dropInPrice: 25,
    description: "Beachfront flows at sunrise. Bring water, leave shoes.",
    amenities: ["Beach sessions", "Mats provided", "Outdoor"],
    hours: "5:30 AM – 8:30 PM",
    touristPass: true,
  },
  {
    id: "ocean-drive-cf",
    name: "Ocean Drive CrossFit",
    type: "CrossFit",
    area: "South Beach",
    lat: 25.78, lng: -80.13,
    rating: 4.7, reviewCount: 298, dropInPrice: 28,
    description: "Affiliate box with daily WODs and open gym hours.",
    amenities: ["Olympic lifting", "Gymnastics rig", "Outdoor turf"],
    hours: "5:30 AM – 9:00 PM",
    touristPass: true,
  },
  {
    id: "coral-way-cf",
    name: "Coral Way CrossFit",
    type: "CrossFit",
    area: "Little Havana",
    lat: 25.749, lng: -80.226,
    rating: 4.6, reviewCount: 176, dropInPrice: 25,
    description: "Tight community vibe. Great coaching for fundamentals.",
    amenities: ["Olympic lifting", "Pull-up rig", "Open gym"],
    hours: "6:00 AM – 9:00 PM",
  },
  {
    id: "cg-climbing",
    name: "Coral Gables Climbing Co.",
    type: "Climbing",
    area: "Coral Gables",
    lat: 25.7215, lng: -80.2684,
    rating: 4.8, reviewCount: 445, dropInPrice: 32,
    description: "Bouldering, top-rope, lead climbing. Indoor cave system.",
    amenities: ["Bouldering", "Top-rope", "Lead", "Gear rental"],
    hours: "10:00 AM – 11:00 PM",
  },
  {
    id: "midbeach-run",
    name: "Mid-Beach Run Club",
    type: "Run Club",
    area: "Mid-Beach",
    lat: 25.812, lng: -80.128,
    rating: 4.9, reviewCount: 189, dropInPrice: 0,
    description: "Free social runs along the boardwalk. All paces welcome.",
    amenities: ["Group runs", "Pacing groups", "Post-run coffee"],
    hours: "Tue/Thu 6:30 AM, Sat 7:30 AM",
  },
  {
    id: "bayfront-run",
    name: "Bayfront Run Crew",
    type: "Run Club",
    area: "Downtown",
    lat: 25.778, lng: -80.183,
    rating: 4.7, reviewCount: 142, dropInPrice: 0,
    description: "Tempo runs, hill repeats, weekend long runs.",
    amenities: ["Group runs", "Track sessions", "Coaches"],
    hours: "Mon/Wed/Fri 6:00 AM, Sat 6:30 AM",
  },
  {
    id: "bayside-hiit",
    name: "Bayside HIIT House",
    type: "HIIT",
    area: "Downtown",
    lat: 25.7752, lng: -80.19,
    rating: 4.8, reviewCount: 356, dropInPrice: 28,
    description: "45-minute high-intensity intervals. Heart rate on screens.",
    amenities: ["Heart rate monitors", "Towels", "Showers"],
    hours: "5:30 AM – 9:30 PM",
  },
  {
    id: "downtown-hiit",
    name: "Downtown HIIT Lab",
    type: "HIIT",
    area: "Downtown",
    lat: 25.7732, lng: -80.1934,
    rating: 4.6, reviewCount: 211, dropInPrice: 26,
    description: "Treadmill-and-floor format. Six-week challenges available.",
    amenities: ["Treadmills", "Strength stations", "Locker rooms"],
    hours: "6:00 AM – 9:00 PM",
  },
  {
    id: "brickell-cycle",
    name: "Brickell Bay Cycle",
    type: "Cycling",
    area: "Brickell",
    lat: 25.77, lng: -80.188,
    rating: 4.8, reviewCount: 489, dropInPrice: 32,
    description: "High-energy indoor cycling with DJ-led playlists.",
    amenities: ["Clip-in shoes", "Towels", "Water"],
    hours: "5:30 AM – 8:30 PM",
    promo: "PROMO",
  },
  {
    id: "beach-cycle",
    name: "Beach Body Cycle",
    type: "Cycling",
    area: "Mid-Beach",
    lat: 25.815, lng: -80.131,
    rating: 4.7, reviewCount: 322, dropInPrice: 30,
    description: "Boutique studio with intervals, climbs, and rhythm rides.",
    amenities: ["Shoe rental", "Showers", "Beachfront"],
    hours: "6:00 AM – 8:00 PM",
  },
  {
    id: "edgewater-boxing",
    name: "Edgewater Boxing Gym",
    type: "Boxing",
    area: "Edgewater",
    lat: 25.7916, lng: -80.1869,
    rating: 4.7, reviewCount: 267, dropInPrice: 24,
    description: "Old-school boxing gym. Heavy bags, sparring rings, real coaches.",
    amenities: ["Heavy bags", "Sparring", "Mitt work"],
    hours: "6:00 AM – 10:00 PM",
  },
  {
    id: "coral-way-boxing",
    name: "Coral Way Boxing Club",
    type: "Boxing",
    area: "Little Havana",
    lat: 25.7505, lng: -80.222,
    rating: 4.8, reviewCount: 198, dropInPrice: 22,
    description: "Cuban boxing tradition. Pro fighters train here.",
    amenities: ["Heavy bags", "Speed bags", "Coaching"],
    hours: "7:00 AM – 9:00 PM",
  },
  {
    id: "mid-beach-strength",
    name: "Mid-Beach Strength House",
    type: "Lifting",
    area: "Mid-Beach",
    lat: 25.811, lng: -80.135,
    rating: 4.5, reviewCount: 156, dropInPrice: 20,
    description: "No-frills strength gym. Just iron and chalk.",
    amenities: ["Squat racks", "Deadlift platforms", "Chalk"],
    hours: "5:00 AM – 11:00 PM",
  },
  {
    id: "coconut-grove-yoga",
    name: "Coconut Grove Yoga Loft",
    type: "Yoga",
    area: "Coconut Grove",
    lat: 25.7295, lng: -80.2435,
    rating: 4.8, reviewCount: 278, dropInPrice: 24,
    description: "Treetop yoga loft with skylight and breeze. Vinyasa & yin.",
    amenities: ["Skylight studio", "Mats", "Tea bar"],
    hours: "6:30 AM – 9:00 PM",
  },
  {
    id: "design-district-pilates",
    name: "Design District Pilates",
    type: "Pilates",
    area: "Design District",
    lat: 25.8137, lng: -80.193,
    rating: 4.7, reviewCount: 165, dropInPrice: 36,
    description: "Reformer + tower combo classes in a gallery-style space.",
    amenities: ["Reformers", "Towers", "Spring board"],
    hours: "6:30 AM – 8:30 PM",
  },
  {
    id: "brickell-yoga",
    name: "Brickell Hot Yoga",
    type: "Yoga",
    area: "Brickell",
    lat: 25.7665, lng: -80.1898,
    rating: 4.6, reviewCount: 312, dropInPrice: 26,
    description: "26 & 2, hot vinyasa, and breathwork. 90-minute classes.",
    amenities: ["Hot studio", "Showers", "Lockers"],
    hours: "6:00 AM – 9:30 PM",
  },
  {
    id: "wynwood-cf",
    name: "Wynwood CrossFit Co.",
    type: "CrossFit",
    area: "Wynwood",
    lat: 25.7995, lng: -80.2001,
    rating: 4.7, reviewCount: 224, dropInPrice: 27,
    description: "Outdoor turf, indoor rig. Daily class plus open gym.",
    amenities: ["Outdoor turf", "Rig", "Olympic lifting"],
    hours: "5:30 AM – 9:00 PM",
  },
  {
    id: "key-biscayne-run",
    name: "Key Biscayne Run Group",
    type: "Run Club",
    area: "Key Biscayne",
    lat: 25.6923, lng: -80.1626,
    rating: 4.9, reviewCount: 87, dropInPrice: 0,
    description: "Causeway long runs and beach miles. Saturdays only.",
    amenities: ["Group runs", "Beach finish", "Free coffee"],
    hours: "Sat 6:30 AM",
  },
  {
    id: "south-beach-cycle",
    name: "South Beach Cycle Co.",
    type: "Cycling",
    area: "South Beach",
    lat: 25.781, lng: -80.135,
    rating: 4.8, reviewCount: 401, dropInPrice: 30,
    description: "Theme rides and live DJs. Beach-vibe boutique.",
    amenities: ["Shoe rental", "Towels", "Smoothie bar"],
    hours: "5:30 AM – 8:30 PM",
  },
  {
    id: "downtown-climbing",
    name: "Downtown Climbing Hub",
    type: "Climbing",
    area: "Downtown",
    lat: 25.776, lng: -80.191,
    rating: 4.6, reviewCount: 142, dropInPrice: 28,
    description: "Bouldering only. Six-week route resets.",
    amenities: ["Bouldering", "Training board", "Gear rental"],
    hours: "11:00 AM – 11:00 PM",
  },
  {
    id: "midbeach-hiit",
    name: "Mid-Beach HIIT Studio",
    type: "HIIT",
    area: "Mid-Beach",
    lat: 25.815, lng: -80.13,
    rating: 4.7, reviewCount: 168, dropInPrice: 28,
    description: "Tabata blocks with kettlebells, ropes, and rower.",
    amenities: ["Kettlebells", "Battle ropes", "Rowers"],
    hours: "6:00 AM – 8:30 PM",
  },
  {
    id: "miami-river-boxing",
    name: "Miami River Boxing",
    type: "Boxing",
    area: "Downtown",
    lat: 25.768, lng: -80.196,
    rating: 4.6, reviewCount: 122, dropInPrice: 22,
    description: "Group boxing classes with rotating stations. All levels.",
    amenities: ["Heavy bags", "Mitt work", "Conditioning"],
    hours: "6:00 AM – 9:30 PM",
  },
  {
    id: "south-pointe-pilates",
    name: "South Pointe Pilates",
    type: "Pilates",
    area: "South Beach",
    lat: 25.7682, lng: -80.135,
    rating: 4.8, reviewCount: 287, dropInPrice: 38,
    description: "Reformer studio with ocean views. Small classes.",
    amenities: ["Reformers", "Ocean views", "Spring board"],
    hours: "6:30 AM – 8:00 PM",
  },
  {
    id: "north-beach-yoga",
    name: "North Beach Yoga Garden",
    type: "Yoga",
    area: "North Beach",
    lat: 25.852, lng: -80.122,
    rating: 4.7, reviewCount: 156, dropInPrice: 22,
    description: "Outdoor garden classes. Bring sunscreen and a mat.",
    amenities: ["Outdoor", "Garden", "Tea after"],
    hours: "7:00 AM – 8:30 PM",
  },
];

export const ACTIVITY_TYPES = [
  "Lifting",
  "Pilates",
  "Yoga",
  "CrossFit",
  "HIIT",
  "Cycling",
  "Run Club",
  "Boxing",
  "Climbing",
];

// Search "center" for distance calculations — Miami midpoint between
// Brickell and South Beach, same as the map default center.
export const MIAMI_CENTER: [number, number] = [25.775, -80.18];

/**
 * Haversine distance in miles between two lat/lng points.
 * Used to compute "X mi away" on each card.
 */
export function distanceMiles(
  a: [number, number],
  b: [number, number]
): number {
  const R = 3958.8; // Earth radius in miles
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b[0] - a[0]);
  const dLng = toRad(b[1] - a[1]);
  const lat1 = toRad(a[0]);
  const lat2 = toRad(b[0]);
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.asin(Math.sqrt(x));
}
