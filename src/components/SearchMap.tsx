"use client";

import dynamic from "next/dynamic";
import { SearchGym } from "@/lib/searchData";
import styles from "./SearchMap.module.css";

const SearchMapInner = dynamic(() => import("./SearchMapInner"), {
  ssr: false,
  loading: () => <div className={styles.mapLoading}>Loading map…</div>,
});

interface SearchMapProps {
  gyms: SearchGym[];
  hoveredId: string | null;
  selectedId: string | null;
  onPinClick: (id: string) => void;
  center: [number, number];
}

export default function SearchMap(props: SearchMapProps) {
  return <SearchMapInner {...props} />;
}
