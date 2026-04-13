"use client";

import { useEffect, useRef, useCallback } from "react";
import createGlobe from "cobe";
import styles from "./Globe.module.css";

// Major fitness cities around the world
const MARKERS: [number, number][] = [
  [25.7617, -80.1918],   // Miami
  [40.7128, -74.006],    // New York
  [34.0522, -118.2437],  // Los Angeles
  [51.5074, -0.1278],    // London
  [48.8566, 2.3522],     // Paris
  [45.4642, 9.19],       // Milan
  [35.6762, 139.6503],   // Tokyo
  [-33.8688, 151.2093],  // Sydney
  [55.7558, 37.6173],    // Moscow
  [1.3521, 103.8198],    // Singapore
  [19.4326, -99.1332],   // Mexico City
  [-22.9068, -43.1729],  // Rio de Janeiro
  [37.7749, -122.4194],  // San Francisco
  [41.9028, 12.4964],    // Rome
  [13.7563, 100.5018],   // Bangkok
  [52.52, 13.405],       // Berlin
  [28.6139, 77.209],     // Delhi
  [31.2304, 121.4737],   // Shanghai
  [43.6532, -79.3832],   // Toronto
  [25.2048, 55.2708],    // Dubai
  [-34.6037, -58.3816],  // Buenos Aires
  [21.3069, -157.8583],  // Honolulu
  [36.1699, -115.1398],  // Las Vegas
  [47.6062, -122.3321],  // Seattle
  [41.3851, 2.1734],     // Barcelona
];

export default function Globe() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pointerInteracting = useRef<number | null>(null);
  const pointerInteractionMovement = useRef(0);
  const phi = useRef(0);
  const width = useRef(0);

  const onResize = useCallback(() => {
    if (canvasRef.current) {
      width.current = canvasRef.current.offsetWidth;
    }
  }, []);

  useEffect(() => {
    window.addEventListener("resize", onResize);
    onResize();

    if (!canvasRef.current) return;

    // Ensure we have a valid width before initializing
    const initialWidth = canvasRef.current.offsetWidth || 400;
    width.current = initialWidth;

    const globe = createGlobe(canvasRef.current, {
      devicePixelRatio: 2,
      width: initialWidth * 2,
      height: initialWidth * 2,
      phi: 0,
      theta: 0.25,
      dark: 1,
      diffuse: 1.2,
      mapSamples: 16000,
      mapBrightness: 6,
      baseColor: [0.15, 0.15, 0.15],
      markerColor: [0.91, 1, 0.24], // GymRoam accent #E8FF3C
      glowColor: [0.15, 0.15, 0.15],
      markers: MARKERS.map(([lat, lng]) => ({
        location: [lat, lng] as [number, number],
        size: 0.06,
      })),
    });

    // Animation loop
    let animationId: number;
    const animate = () => {
      if (!pointerInteracting.current) {
        phi.current += 0.003;
      }
      globe.update({
        phi: phi.current + pointerInteractionMovement.current,
        width: width.current * 2,
        height: width.current * 2,
      });
      animationId = requestAnimationFrame(animate);
    };
    animationId = requestAnimationFrame(animate);

    setTimeout(() => {
      if (canvasRef.current) {
        canvasRef.current.style.opacity = "1";
      }
    }, 100);

    return () => {
      cancelAnimationFrame(animationId);
      globe.destroy();
      window.removeEventListener("resize", onResize);
    };
  }, [onResize]);

  return (
    <section className={styles.section}>
      <div className={styles.inner}>
        <div className={styles.text}>
          <h2 className="fade-up">Your gym.<br /><span className={styles.accent}>Every city.</span></h2>
          <p className="fade-up">
            From Miami to Milan, Tokyo to Toronto — GymRoam maps gyms, studios,
            and wellness centers across the globe so you never skip a workout while traveling.
          </p>
          <div className={`${styles.stats} fade-up`}>
            <div className={styles.stat}>
              <span className={styles.statNum}>25+</span>
              <span className={styles.statLabel}>Cities</span>
            </div>
            <div className={styles.stat}>
              <span className={styles.statNum}>10K+</span>
              <span className={styles.statLabel}>Gyms</span>
            </div>
            <div className={styles.stat}>
              <span className={styles.statNum}>6</span>
              <span className={styles.statLabel}>Continents</span>
            </div>
          </div>
        </div>
        <div className={styles.globeWrap}>
          <canvas
            ref={canvasRef}
            className={styles.globe}
            onPointerDown={(e) => {
              pointerInteracting.current = e.clientX - pointerInteractionMovement.current;
              if (canvasRef.current) canvasRef.current.style.cursor = "grabbing";
            }}
            onPointerUp={() => {
              pointerInteracting.current = null;
              if (canvasRef.current) canvasRef.current.style.cursor = "grab";
            }}
            onPointerOut={() => {
              pointerInteracting.current = null;
              if (canvasRef.current) canvasRef.current.style.cursor = "grab";
            }}
            onMouseMove={(e) => {
              if (pointerInteracting.current !== null) {
                const delta = e.clientX - pointerInteracting.current;
                pointerInteractionMovement.current = delta / 200;
              }
            }}
            onTouchMove={(e) => {
              if (pointerInteracting.current !== null && e.touches[0]) {
                const delta = e.touches[0].clientX - pointerInteracting.current;
                pointerInteractionMovement.current = delta / 100;
              }
            }}
          />
          <div className={styles.globeGlow} />
        </div>
      </div>
    </section>
  );
}
