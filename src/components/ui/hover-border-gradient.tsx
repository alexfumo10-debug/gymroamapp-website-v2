/**
 * HoverBorderGradient — pill button with a rotating brand-color shine
 * around the border and a black interior. On hover the rotating shine
 * pauses and intensifies into a full-glow highlight.
 *
 * Both the rotating border gradient and the hover highlight use the
 * GymRoam accent yellow (#E8FF3C) so the effect stays on-brand.
 *
 * Adapted from the open-source HoverBorderGradient pattern; colors,
 * typography, and rounded-pill geometry tuned for GymRoam.
 */

"use client";

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

type Direction = "TOP" | "LEFT" | "BOTTOM" | "RIGHT";

/**
 * Each entry is the radial gradient that paints when the "shine" is on
 * that side of the border. Keep the alpha 0% color matching the
 * surrounding border so the un-lit sides remain invisible.
 *
 * Color: GymRoam accent #E8FF3C
 */
const ROTATING_GRADIENTS: Record<Direction, string> = {
  TOP:    "radial-gradient(20.7% 50% at 50% 0%,   #E8FF3C 0%, rgba(232, 255, 60, 0) 100%)",
  LEFT:   "radial-gradient(16.6% 43.1% at 0% 50%, #E8FF3C 0%, rgba(232, 255, 60, 0) 100%)",
  BOTTOM: "radial-gradient(20.7% 50% at 50% 100%, #E8FF3C 0%, rgba(232, 255, 60, 0) 100%)",
  RIGHT:  "radial-gradient(16.2% 41.2% at 100% 50%, #E8FF3C 0%, rgba(232, 255, 60, 0) 100%)",
};

/** Full glow used when the button is hovered. */
const HOVER_HIGHLIGHT =
  "radial-gradient(75% 181.16% at 50% 50%, #E8FF3C 0%, rgba(232, 255, 60, 0) 100%)";

interface HoverBorderGradientProps extends React.HTMLAttributes<HTMLElement> {
  as?: React.ElementType;
  /** Container (outer) class — sits on the rotating gradient layer. */
  containerClassName?: string;
  /** Inner (black pill) class — controls padding, text color, font. */
  className?: string;
  /** Seconds between rotation steps. Smaller = faster spin. */
  duration?: number;
  /** Spin direction. `true` is the visual "right way" for most CTAs. */
  clockwise?: boolean;
  /** Optional href — supported when rendered `as={Link}` or `as="a"`. */
  href?: string;
  /** Optional target — supported for anchor / Link usage. */
  target?: string;
  /** Optional rel — supported for anchor / Link usage. */
  rel?: string;
  children?: React.ReactNode;
}

export function HoverBorderGradient({
  children,
  containerClassName,
  className,
  as: Element = "button",
  duration = 1,
  clockwise = true,
  ...props
}: HoverBorderGradientProps) {
  const [hovered, setHovered] = useState(false);
  const [direction, setDirection] = useState<Direction>("BOTTOM");

  const rotateDirection = (current: Direction): Direction => {
    const directions: Direction[] = ["TOP", "LEFT", "BOTTOM", "RIGHT"];
    const i = directions.indexOf(current);
    const next = clockwise
      ? (i - 1 + directions.length) % directions.length
      : (i + 1) % directions.length;
    return directions[next];
  };

  useEffect(() => {
    // While not hovered, rotate the shine around the border.
    // Hover stops the rotation so the full highlight can take over.
    if (!hovered) {
      const interval = setInterval(() => {
        setDirection((prev) => rotateDirection(prev));
      }, duration * 1000);
      return () => clearInterval(interval);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hovered, duration, clockwise]);

  return (
    <Element
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={cn(
        // Outer wrapper: rounded-full pill, transparent base, p-px is the
        // border thickness that the gradient layer paints under.
        "relative inline-flex h-min w-fit items-center justify-center overflow-visible rounded-full bg-black/40 p-px backdrop-blur-sm transition duration-500 hover:bg-black/60",
        containerClassName
      )}
      {...props}
    >
      {/* Inner pill — black interior with white text. */}
      <div
        className={cn(
          "relative z-10 w-auto rounded-[inherit] bg-black px-5 py-2 text-sm font-bold text-white",
          className
        )}
      >
        {children}
      </div>

      {/* Animated gradient border layer. */}
      <motion.div
        className="absolute inset-0 z-0 flex-none overflow-hidden rounded-[inherit]"
        style={{ filter: "blur(2px)", width: "100%", height: "100%" }}
        initial={{ background: ROTATING_GRADIENTS[direction] }}
        animate={{
          background: hovered
            ? [ROTATING_GRADIENTS[direction], HOVER_HIGHLIGHT]
            : ROTATING_GRADIENTS[direction],
        }}
        transition={{ ease: "linear", duration: duration ?? 1 }}
      />

      {/*
        Inner black mask sitting inside the gradient layer so the
        gradient only shows as a 1px border around the pill, not as a
        filled background.
      */}
      <div className="absolute inset-[1px] z-[1] flex-none rounded-[100px] bg-black" />
    </Element>
  );
}

export default HoverBorderGradient;
