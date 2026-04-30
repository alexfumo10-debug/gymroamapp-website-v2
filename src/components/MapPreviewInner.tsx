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
import { MIAMI_GYMS } from "./mapData";
import styles from "./MapPreview.module.css";

// Custom yellow accent pin (full opacity, used when matching the active filter).
const pinIcon = L.divIcon({
  className: styles.pinWrap,
  html: `<div class="${styles.pinDot}"><div class="${styles.pinCore}"></div></div>`,
  iconSize: [24, 24],
  iconAnchor: [12, 12],
});

// Dimmed variant — applied to pins that don't match the active filter.
const pinIconDim = L.divIcon({
  className: styles.pinWrap,
  html: `<div class="${styles.pinDot} ${styles.pinDotDim}"><div class="${styles.pinCore} ${styles.pinCoreDim}"></div></div>`,
  iconSize: [24, 24],
  iconAnchor: [12, 12],
});

// Miami center — between South Beach and Brickell so all pins are visible.
const MIAMI_CENTER: [number, number] = [25.775, -80.18];
const MIAMI_ZOOM = 12;

interface MapPreviewInnerProps {
  activeFilter: string | null;
}

export default function MapPreviewInner({ activeFilter }: MapPreviewInnerProps) {
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
      {MIAMI_GYMS.map((gym) => {
        const matches = !activeFilter || gym.type === activeFilter;
        return (
          <Marker
            key={gym.name}
            position={[gym.lat, gym.lng]}
            icon={matches ? pinIcon : pinIconDim}
            opacity={matches ? 1 : 0.45}
            zIndexOffset={matches ? 100 : 0}
          >
            <Popup className={styles.popup}>
              <div className={styles.popupName}>{gym.name}</div>
              <div className={styles.popupMeta}>
                {gym.type} &middot; {gym.area}
              </div>
              <div className={styles.popupTag}>Available at launch</div>
            </Popup>
          </Marker>
        );
      })}
    </MapContainer>
  );
}
