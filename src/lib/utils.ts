/**
 * `cn` — the standard shadcn-style class-name merger.
 *
 * `clsx` handles conditional classes (strings, arrays, objects) and
 * `tailwind-merge` resolves Tailwind utility conflicts (e.g. when a
 * later `px-4` should override an earlier `px-2`).
 *
 * Use this for any component that accepts a `className` override prop.
 */

import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
