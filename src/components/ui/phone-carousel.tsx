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
 * toward the back fade out so only ~3 cards read at once. Respects
 * `prefers-reduced-motion`.
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
  /** Degrees rotated per animation frame (~60fps). 0.1 ≈ 60s per full spin. */
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

export function PhoneCarousel({ items, autoRotateSpeed = 0.1 }: Props) {
  const [rotation, setRotation] = useState(0);
  const [sizes, setSizes] = useState(() => getSizes(1200));
  const animationFrameRef = useRef<number | null>(null);

  // Responsive sizing — runs on mount + on resize.
  useEffect(() => {
    const update = () => setSizes(getSizes(window.innerWidth));
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  // Auto-rotation loop. Disabled entirely for users with
  // prefers-reduced-motion: reduce.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (mq.matches) return;

    const tick = () => {
      setRotation((prev) => prev + autoRotateSpeed);
      animationFrameRef.current = requestAnimationFrame(tick);
    };
    animationFrameRef.current = requestAnimationFrame(tick);
    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [autoRotateSpeed]);

  const anglePerItem = 360 / items.length;
  const { radius, cardW, cardH } = sizes;

  return (
    <div
      className={styles.scene}
      role="region"
      aria-label="GymRoam app screenshots"
    >
      <div
        className={styles.orbit}
        style={{ transform: `rotateY(${rotation}deg)` }}
      >
        {items.map((item, i) => {
          const itemAngle = i * anglePerItem;
          // How far this card is from the front-facing position (0° relative).
          // Softer falloff than the demo so cards near the back stay readable
          // instead of dropping to near-invisible.
          const relative = (itemAngle + rotation) % 360;
          const normalized = Math.abs(relative > 180 ? 360 - relative : relative);
          const opacity = Math.max(0.4, 1 - normalized / 240);

          return (
            <div
              key={item.src}
              className={styles.card}
              aria-hidden="true"
              style={{
                width: cardW,
                height: cardH,
                marginLeft: -cardW / 2,
                marginTop: -cardH / 2,
                transform: `rotateY(${itemAngle}deg) translateZ(${radius}px)`,
                opacity,
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
