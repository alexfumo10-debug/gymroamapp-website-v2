"use client";

/**
 * Leaflet map for /search. Client-only (parent loads via next/dynamic
 * with ssr: false) because Leaflet touches `window` on import.
 */

import { useEffect, useRef } from "react";
import { MapContainer, TileLayer, Marker, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { SearchGym, MIAMI_CENTER } from "@/lib/searchData";
import styles from "./SearchMap.module.css";

interface SearchMapInnerProps {
  gyms: SearchGym[];
  hoveredId: string | null;
  selectedId: string | null;
  onPinClick: (id: string) => void;
}

const standardIcon = L.divIcon({
  className: styles.pinWrap,
  html: `<div class="${styles.pinDot}"><div class="${styles.pinCore}"></div></div>`,
  iconSize: [22, 22],
  iconAnchor: [11, 11],
});

const activeIcon = L.divIcon({
  className: styles.pinWrap,
  html: `<div class="${styles.pinDot} ${styles.pinDotActive}"><div class="${styles.pinCore} ${styles.pinCoreActive}"></div></div>`,
  iconSize: [32, 32],
  iconAnchor: [16, 16],
});

// Recenter map to fit all visible gyms whenever the gym list changes.
function FitBounds({ gyms }: { gyms: SearchGym[] }) {
  const map = useMap();
  useEffect(() => {
    if (gyms.length === 0) return;
    if (gyms.length === 1) {
      map.setView([gyms[0].lat, gyms[0].lng], 14);
      return;
    }
    const bounds = L.latLngBounds(gyms.map((g) => [g.lat, g.lng]));
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
  }, [gyms, map]);
  return null;
}

export default function SearchMapInner({
  gyms,
  hoveredId,
  selectedId,
  onPinClick,
}: SearchMapInnerProps) {
  const markersRef = useRef<Map<string, L.Marker>>(new Map());

  return (
    <MapContainer
      center={MIAMI_CENTER}
      zoom={12}
      scrollWheelZoom
      className={styles.map}
      attributionControl
    >
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
        subdomains="abcd"
        maxZoom={19}
      />
      <FitBounds gyms={gyms} />
      {gyms.map((gym) => {
        const isHighlighted = gym.id === hoveredId || gym.id === selectedId;
        return (
          <Marker
            key={gym.id}
            position={[gym.lat, gym.lng]}
            icon={isHighlighted ? activeIcon : standardIcon}
            zIndexOffset={isHighlighted ? 1000 : 0}
            ref={(ref) => {
              if (ref) markersRef.current.set(gym.id, ref);
              else markersRef.current.delete(gym.id);
            }}
            eventHandlers={{
              click: () => onPinClick(gym.id),
            }}
          />
        );
      })}
    </MapContainer>
  );
}
