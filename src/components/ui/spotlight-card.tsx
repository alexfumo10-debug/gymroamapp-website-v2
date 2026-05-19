/**
 * GlowCard — card with a per-card cursor-following spotlight.
 *
 * Each card listens to its own pointermove and tracks cursor position
 * relative to the card (not the viewport). The hovered card lights up;
 * other cards stay neutral.
 *
 * The visual is built from two stacked layers:
 *   1. Outer wrapper with a radial gradient at (mx, my) — when only
 *      the 1px padding shows, this becomes a brand-yellow "lit border"
 *      that follows the cursor.
 *   2. Inner solid surface with a second, softer radial gradient — a
 *      subtle interior glow under where the cursor hovers.
 *
 * Both gradients fade in on `:hover` (300ms) and fade out on mouseleave.
 */

"use client";

import React, { useRef, type ReactNode } from "react";
import styles from "./spotlight-card.module.css";

interface GlowCardProps {
  children: ReactNode;
  className?: string;
}

export function GlowCard({ children, className = "" }: GlowCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = cardRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    // Cursor in card-relative coordinates so the spotlight stays under
    // the actual finger/cursor position regardless of scroll or viewport.
    el.style.setProperty("--mx", `${e.clientX - rect.left}px`);
    el.style.setProperty("--my", `${e.clientY - rect.top}px`);
  };

  return (
    <div
      ref={cardRef}
      className={styles.card}
      onMouseMove={handleMouseMove}
    >
      {/* className lands on the inner surface so consumer styles
          (padding, flex, gap) drive the content layout. The outer
          .card stays a fixed-thickness gradient border wrapper. */}
      <div className={`${styles.inner} ${className}`}>{children}</div>
    </div>
  );
}

export default GlowCard;
