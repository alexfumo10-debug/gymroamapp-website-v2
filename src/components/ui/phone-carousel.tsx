/**
 * 3D phone-screenshot carousel for the hero.
 *
 * Adapted from the open-source CircularGallery pattern, but stripped of:
 *  - scroll-linked rotation (we only auto-rotate; the hero is one
 *    viewport tall, scroll-driven rotation only made sense in the
 *    original full-screen sticky demo)
 *  - text caption overlays (clean phone-only per design call)
 *  - shadcn theme tokens (uses our --bg / --border / --accent vars)
 *
 * Each card renders as an iPhone-shaped frame with rounded corners and
 * a dark bezel. Front-facing card is fully opaque; cards rotating
 * toward the back fade out so only ~3 cards read at once.
 *
 * Implementation note: the rotation loop writes the orbit transform
 * and each card's opacity DIRECTLY to the DOM via refs instead of
 * going through React state. This is the iOS-Safari-safe pattern for
 * rAF-driven 3D animation:
 *   - No 60fps React re-renders → no reconciliation overhead.
 *   - No state batching / scheduler quirks that on iOS Safari were
 *     causing the orbit transform to read as unchanged each frame
 *     (the "static carousel on mobile" bug Kevin saw).
 *   - The `translateZ(0)` GPU hint hack — which was breaking the
 *     preserve-3d context on iOS and flattening the cards onto the
 *     orbit's plane (causing the "fading without moving" symptom)
 *     is gone. The orbit transform is a pure rotateY now.
 */

"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import styles from "./phone-carousel.module.css";

export interface PhoneCarouselItem {
  src: string;
  alt: string;
}

interface Props {
  items: PhoneCarouselItem[];
  /** Degrees rotated per animation frame (~60fps). 0.15 ≈ 40s per full spin. */
  autoRotateSpeed?: number;
}

/**
 * Responsive orbit + card sizes. Tightened orbit so adjacent cards
 * overlap slightly (chord ≈ card width), giving a denser cluster that
 * reads as a connected carousel instead of distant satellites. Cards
 * are double-sided so back-facing rotations still show their image.
 */
function getSizes(width: number) {
  if (width < 640) return { radius: 130, cardW: 150, cardH: 320 };
  if (width < 1024) return { radius: 180, cardW: 180, cardH: 380 };
  return { radius: 220, cardW: 200, cardH: 430 };
}

export function PhoneCarousel({ items, autoRotateSpeed = 0.15 }: Props) {
  // Sizes still live in React state — they affect element dimensions
  // and need to re-render the JSX when the viewport breakpoint changes.
  const [sizes, setSizes] = useState(() => getSizes(1200));

  // Refs for direct DOM access in the rAF loop. Rotation itself is
  // a ref (not state) so we don't trigger React re-renders every frame.
  const orbitRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);
  const rotationRef = useRef(0);
  const animationFrameRef = useRef<number | null>(null);

  // Responsive sizing — runs on mount + on resize.
  useEffect(() => {
    const update = () => setSizes(getSizes(window.innerWidth));
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  // Auto-rotation loop. Runs unconditionally so the carousel stays
  // alive on iOS Low Power Mode (which silently sets prefers-reduced-
  // motion: reduce). The product showcase shouldn't go static there.
  //
  // The transform and per-card opacity are written DIRECTLY to the
  // DOM via refs — no React state updates per frame. This is what
  // finally fixed the carousel on mobile Safari: with state updates,
  // iOS Safari was somehow not repainting the orbit transform.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const anglePerItem = 360 / items.length;

    const tick = () => {
      rotationRef.current += autoRotateSpeed;
      const rotation = rotationRef.current;

      if (orbitRef.current) {
        orbitRef.current.style.transform = `rotateY(${rotation}deg)`;
      }

      // Per-card opacity — same falloff curve as before, just applied
      // via direct style mutation instead of React props.
      for (let i = 0; i < cardRefs.current.length; i++) {
        const cardEl = cardRefs.current[i];
        if (!cardEl) continue;
        const itemAngle = i * anglePerItem;
        const relative = (itemAngle + rotation) % 360;
        const normalized = Math.abs(relative > 180 ? 360 - relative : relative);
        const opacity = Math.max(0.4, 1 - normalized / 240);
        cardEl.style.opacity = String(opacity);
      }

      animationFrameRef.current = requestAnimationFrame(tick);
    };
    animationFrameRef.current = requestAnimationFrame(tick);
    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [autoRotateSpeed, items.length]);

  const anglePerItem = 360 / items.length;
  const { radius, cardW, cardH } = sizes;

  return (
    <div
      className={styles.scene}
      role="region"
      aria-label="GymRoam app screenshots"
    >
      {/* Orbit: rotation set by rAF directly on this element's transform
          style — no `style={{ transform: ... }}` here, so React doesn't
          ever try to "manage" the transform. */}
      <div ref={orbitRef} className={styles.orbit}>
        {items.map((item, i) => {
          const itemAngle = i * anglePerItem;
          return (
            <div
              key={item.src}
              ref={(el) => {
                cardRefs.current[i] = el;
              }}
              className={styles.card}
              aria-hidden="true"
              style={{
                width: cardW,
                height: cardH,
                marginLeft: -cardW / 2,
                marginTop: -cardH / 2,
                // Each card's position in the orbit — fixed for the
                // card's lifetime. The orbit's rotation is what spins
                // the whole arrangement past the camera.
                transform: `rotateY(${itemAngle}deg) translateZ(${radius}px)`,
                // Initial opacity — overwritten by the rAF tick on the
                // very first frame so there's no visible "snap-in."
                opacity: 1,
              }}
            >
              {/* Front face — visible when this card is on the camera-facing
                  half of the orbit. Loading is eager (not lazy) because every
                  card sits above the fold in the hero. */}
              <div className={styles.cardFace}>
                <Image
                  src={item.src}
                  alt={item.alt}
                  fill
                  sizes={`${cardW}px`}
                  style={{ objectFit: "cover" }}
                  loading="eager"
                />
              </div>
              {/* Back face — visible when this card rotates to the far side.
                  Rotated 180° so its normal points outward; the image inside
                  is scaleX(-1) to cancel the parent flip so the content reads
                  correctly (not mirrored). */}
              <div className={`${styles.cardFace} ${styles.cardBack}`}>
                <Image
                  src={item.src}
                  alt=""
                  fill
                  sizes={`${cardW}px`}
                  style={{ objectFit: "cover", transform: "scaleX(-1)" }}
                  loading="eager"
                  aria-hidden="true"
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default PhoneCarousel;
