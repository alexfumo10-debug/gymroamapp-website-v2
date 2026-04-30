"use client";

/**
 * Inner Leaflet map. Loaded only on the client (parent uses next/dynamic
 * with ssr: false) because Leaflet touches `window` and `document` on
 * import.
 *
 * Tiles: CartoDB Dark Matter — free with attribution, perfect for the
 * GymRoam dark theme.
 *
 * Pins: hand-curated mock gyms across Miami neighborhoods. NOT real
 * partnerships — names are fictional. Coordinates are real Miami spots.
 */

import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import styles from "./MapPreview.module.css";

interface MockGym {
  name: string;
  type: string;
  area: string;
  lat: number;
  lng: number;
}

const MIAMI_GYMS: MockGym[] = [
  { name: "Iron Forge Athletic Club", type: "Lifting", area: "South Beach", lat: 25.7825, lng: -80.134 },
  { name: "Brickell Pilates Lab", type: "Pilates", area: "Brickell", lat: 25.7651, lng: -80.1922 },
  { name: "Wynwood Wellness Studio", type: "Yoga", area: "Wynwood", lat: 25.801, lng: -80.199 },
  { name: "Ocean Drive CrossFit", type: "CrossFit", area: "South Beach", lat: 25.78, lng: -80.13 },
  { name: "Coral Gables Climbing Co.", type: "Climbing", area: "Coral Gables", lat: 25.7215, lng: -80.2684 },
  { name: "Mid-Beach Run Club", type: "Run Club", area: "Mid-Beach", lat: 25.812, lng: -80.128 },
  { name: "Bayside HIIT House", type: "HIIT", area: "Downtown", lat: 25.7752, lng: -80.19 },
  { name: "Coconut Grove Pilates", type: "Pilates", area: "Coconut Grove", lat: 25.7282, lng: -80.2433 },
  { name: "Brickell Bay Cycle", type: "Cycling", area: "Brickell", lat: 25.77, lng: -80.188 },
  { name: "Edgewater Boxing Gym", type: "Boxing", area: "Edgewater", lat: 25.7916, lng: -80.1869 },
];

// Custom yellow accent pin built as an inline SVG data URL.
const pinIcon = L.divIcon({
  className: styles.pinWrap,
  html: `
    <div class="${styles.pinDot}">
      <div class="${styles.pinCore}"></div>
    </div>
  `,
  iconSize: [24, 24],
  iconAnchor: [12, 12],
});

// Miami center — between South Beach and Brickell so all pins are visible.
const MIAMI_CENTER: [number, number] = [25.775, -80.18];
const MIAMI_ZOOM = 12;

export default function MapPreviewInner() {
  return (
    <MapContainer
      center={MIAMI_CENTER}
      zoom={MIAMI_ZOOM}
      scrollWheelZoom={false}
      className={styles.map}
      attributionControl={true}
    >
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
        subdomains="abcd"
        maxZoom={19}
      />
      {MIAMI_GYMS.map((gym) => (
        <Marker key={gym.name} position={[gym.lat, gym.lng]} icon={pinIcon}>
          <Popup className={styles.popup}>
            <div className={styles.popupName}>{gym.name}</div>
            <div className={styles.popupMeta}>
              {gym.type} &middot; {gym.area}
            </div>
            <div className={styles.popupTag}>Available at launch</div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
