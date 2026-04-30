/**
 * Mock gym data used by the homepage map preview. Kept in its own
 * file (no Leaflet import) so it can be safely imported from server
 * components or the SSR pass without dragging `window` references in.
 */

export interface MockGym {
  name: string;
  type: string;
  area: string;
  lat: number;
  lng: number;
}

export const MIAMI_GYMS: MockGym[] = [
  { name: "Iron Forge Athletic Club", type: "Lifting", area: "South Beach", lat: 25.7825, lng: -80.134 },
  { name: "Brickell Strong", type: "Lifting", area: "Brickell", lat: 25.7642, lng: -80.193 },
  { name: "Wynwood Lifting Hall", type: "Lifting", area: "Wynwood", lat: 25.8015, lng: -80.1968 },
  { name: "Brickell Pilates Lab", type: "Pilates", area: "Brickell", lat: 25.7651, lng: -80.1922 },
  { name: "Coconut Grove Pilates", type: "Pilates", area: "Coconut Grove", lat: 25.7282, lng: -80.2433 },
  { name: "Wynwood Wellness Studio", type: "Yoga", area: "Wynwood", lat: 25.801, lng: -80.199 },
  { name: "Sunrise Yoga Co.", type: "Yoga", area: "South Beach", lat: 25.7855, lng: -80.131 },
  { name: "Ocean Drive CrossFit", type: "CrossFit", area: "South Beach", lat: 25.78, lng: -80.13 },
  { name: "Coral Way CrossFit", type: "CrossFit", area: "Little Havana", lat: 25.749, lng: -80.226 },
  { name: "Coral Gables Climbing Co.", type: "Climbing", area: "Coral Gables", lat: 25.7215, lng: -80.2684 },
  { name: "Mid-Beach Run Club", type: "Run Club", area: "Mid-Beach", lat: 25.812, lng: -80.128 },
  { name: "Bayfront Run Crew", type: "Run Club", area: "Downtown", lat: 25.778, lng: -80.183 },
  { name: "Bayside HIIT House", type: "HIIT", area: "Downtown", lat: 25.7752, lng: -80.19 },
  { name: "Downtown HIIT Lab", type: "HIIT", area: "Downtown", lat: 25.7732, lng: -80.1934 },
  { name: "Brickell Bay Cycle", type: "Cycling", area: "Brickell", lat: 25.77, lng: -80.188 },
  { name: "Beach Body Cycle", type: "Cycling", area: "Mid-Beach", lat: 25.815, lng: -80.131 },
  { name: "Edgewater Boxing Gym", type: "Boxing", area: "Edgewater", lat: 25.7916, lng: -80.1869 },
  { name: "Coral Way Boxing Club", type: "Boxing", area: "Little Havana", lat: 25.7505, lng: -80.222 },
];
