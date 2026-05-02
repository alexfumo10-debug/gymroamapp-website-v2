/**
 * Preset cities. Selecting one is instant — coords are hardcoded so we
 * never wait on geocoding. Custom cities go through geocode.ts.
 *
 * `neighborhoods` is optional richer data: when provided, generated gym
 * names use real neighborhood names. When absent, we fall back to
 * directional descriptors (Downtown / North / East / etc.).
 */

export interface CityPreset {
  /** Lowercased canonical key */
  id: string;
  /** Display name, e.g. "Miami" */
  name: string;
  /** "Miami, FL" or "London, UK" */
  region: string;
  lat: number;
  lng: number;
  /** Optional neighborhood names for richer generated gyms */
  neighborhoods?: string[];
}

export const CITY_PRESETS: CityPreset[] = [
  {
    id: "miami",
    name: "Miami",
    region: "Miami, FL",
    lat: 25.775,
    lng: -80.18,
    neighborhoods: ["South Beach", "Brickell", "Wynwood", "Coconut Grove", "Coral Gables", "Mid-Beach", "Edgewater", "Downtown", "Design District", "Little Havana", "Key Biscayne", "North Beach"],
  },
  {
    id: "nyc",
    name: "New York",
    region: "New York, NY",
    lat: 40.7549,
    lng: -73.984,
    neighborhoods: ["SoHo", "Tribeca", "West Village", "East Village", "Williamsburg", "Bushwick", "DUMBO", "Park Slope", "Upper West Side", "Upper East Side", "Chelsea", "Lower East Side"],
  },
  {
    id: "la",
    name: "Los Angeles",
    region: "Los Angeles, CA",
    lat: 34.05,
    lng: -118.25,
    neighborhoods: ["Venice", "Santa Monica", "West Hollywood", "Silver Lake", "Echo Park", "Beverly Hills", "Brentwood", "Culver City", "DTLA", "Hollywood", "Highland Park", "Mar Vista"],
  },
  {
    id: "london",
    name: "London",
    region: "London, UK",
    lat: 51.5074,
    lng: -0.1278,
    neighborhoods: ["Shoreditch", "Soho", "Camden", "Notting Hill", "Hackney", "Clapham", "Brixton", "Islington", "Kensington", "Covent Garden", "Hampstead", "Bermondsey"],
  },
  {
    id: "paris",
    name: "Paris",
    region: "Paris, France",
    lat: 48.8566,
    lng: 2.3522,
    neighborhoods: ["Le Marais", "Montmartre", "Saint-Germain", "Bastille", "Belleville", "Pigalle", "Champs-Élysées", "République", "Canal Saint-Martin", "Latin Quarter", "Oberkampf", "Montparnasse"],
  },
  {
    id: "tokyo",
    name: "Tokyo",
    region: "Tokyo, Japan",
    lat: 35.6762,
    lng: 139.6503,
    neighborhoods: ["Shibuya", "Shinjuku", "Harajuku", "Roppongi", "Daikanyama", "Ginza", "Nakameguro", "Ebisu", "Aoyama", "Asakusa", "Akihabara", "Shimokitazawa"],
  },
  {
    id: "dubai",
    name: "Dubai",
    region: "Dubai, UAE",
    lat: 25.2048,
    lng: 55.2708,
    neighborhoods: ["Marina", "Downtown", "JBR", "Business Bay", "DIFC", "Palm Jumeirah", "Jumeirah", "Al Quoz", "Deira", "Mirdif", "Dubai Hills", "City Walk"],
  },
  {
    id: "sydney",
    name: "Sydney",
    region: "Sydney, Australia",
    lat: -33.8688,
    lng: 151.2093,
    neighborhoods: ["Bondi", "Surry Hills", "Newtown", "Paddington", "Manly", "Coogee", "Darlinghurst", "Potts Point", "Glebe", "Redfern", "Double Bay", "Balmain"],
  },
  {
    id: "barcelona",
    name: "Barcelona",
    region: "Barcelona, Spain",
    lat: 41.3851,
    lng: 2.1734,
    neighborhoods: ["Eixample", "Gràcia", "El Born", "Barceloneta", "Poble-sec", "El Raval", "Sant Antoni", "Gothic Quarter", "Sarrià", "Poblenou"],
  },
  {
    id: "berlin",
    name: "Berlin",
    region: "Berlin, Germany",
    lat: 52.52,
    lng: 13.405,
    neighborhoods: ["Mitte", "Kreuzberg", "Friedrichshain", "Prenzlauer Berg", "Neukölln", "Charlottenburg", "Schöneberg", "Wedding", "Moabit", "Tiergarten"],
  },
  {
    id: "mexico-city",
    name: "Mexico City",
    region: "Mexico City, Mexico",
    lat: 19.4326,
    lng: -99.1332,
    neighborhoods: ["Roma Norte", "Condesa", "Polanco", "Coyoacán", "San Ángel", "Juárez", "Centro", "Doctores", "Roma Sur", "Narvarte"],
  },
  {
    id: "toronto",
    name: "Toronto",
    region: "Toronto, Canada",
    lat: 43.6532,
    lng: -79.3832,
    neighborhoods: ["Queen West", "Kensington Market", "Yorkville", "Liberty Village", "Leslieville", "The Annex", "Distillery District", "Riverdale", "King West", "Junction"],
  },
];

export function findPreset(query: string): CityPreset | undefined {
  const q = query.trim().toLowerCase();
  return CITY_PRESETS.find(
    (c) => c.id === q || c.name.toLowerCase() === q
  );
}
