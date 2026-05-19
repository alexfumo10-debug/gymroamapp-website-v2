/**
 * Hero topographic background.
 *
 * Renders an inline SVG of organic contour lines using a marching-
 * squares algorithm over a smooth 2D pseudo-noise field. This produces
 * real topo-map-style contours — flowing, organic, with natural peaks
 * and valleys — instead of concentric "rings" around fixed centers.
 *
 * Strategy:
 *   1. Sample a smooth 2D noise function (sum of sines at different
 *      frequencies) on a regular grid.
 *   2. For each contour level (evenly spaced between min and max
 *      sampled values), run marching squares across the grid to
 *      extract the isoline as a set of line segments.
 *   3. Output one SVG <path> per contour level. Each path is just
 *      M…L… pairs (line segments per crossed cell).
 *
 * Math runs once at module load, so the resulting paths are embedded
 * as constants in the JS bundle and shipped as static markup — no
 * runtime cost after first evaluation. SSR-safe (no DOM access).
 *
 * Decorative only — aria-hidden so it's invisible to screen readers.
 */

import styles from "./HeroTopo.module.css";

const W = 1600;
const H = 1000;
const COLS = 64; // grid resolution — higher = smoother curves, larger SVG
const ROWS = 40;
const CONTOUR_COUNT = 16;

const CELL_W = W / COLS;
const CELL_H = H / ROWS;

/**
 * Smooth 2D pseudo-noise as a sum of sines at different frequencies.
 * Range roughly [-2.5, 2.5]. Deterministic given (nx, ny), so the
 * resulting topo is identical on server and client (no hydration drift).
 */
function noise(nx: number, ny: number): number {
  return (
    Math.sin(nx * 1.7) * Math.cos(ny * 2.1) +
    Math.sin(nx * 3.3 + ny * 1.8) * 0.7 +
    Math.cos(nx * 4.5 - ny * 3.1) * 0.5 +
    Math.sin(nx * 7.0 + ny * 5.2) * 0.3
  );
}

// Sample the noise at each grid corner.
const grid: number[][] = [];
let minVal = Infinity;
let maxVal = -Infinity;
for (let r = 0; r <= ROWS; r++) {
  const row: number[] = [];
  for (let c = 0; c <= COLS; c++) {
    // Multiply input by small constants to control "zoom" of the noise
    // — smaller multipliers = wider, smoother features.
    const v = noise((c / COLS) * 6, (r / ROWS) * 4);
    row.push(v);
    if (v < minVal) minVal = v;
    if (v > maxVal) maxVal = v;
  }
  grid.push(row);
}

// Evenly spaced contour thresholds across the value range.
const thresholds: number[] = [];
for (let i = 0; i < CONTOUR_COUNT; i++) {
  thresholds.push(minVal + ((i + 0.5) / CONTOUR_COUNT) * (maxVal - minVal));
}

/** Linear interpolation factor for where a contour crosses an edge. */
function lerp(a: number, b: number, t: number): number {
  return (t - a) / (b - a);
}

/**
 * Marching squares — extract isoline line segments for one threshold.
 * For each grid cell we look at which of the 4 corners are above the
 * threshold; that 4-bit pattern picks one of 16 cases, each of which
 * defines the line segment(s) crossing the cell.
 */
function buildContour(threshold: number): string {
  const parts: string[] = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const tl = grid[r][c];
      const tr = grid[r][c + 1];
      const br = grid[r + 1][c + 1];
      const bl = grid[r + 1][c];
      const idx =
        (tl >= threshold ? 1 : 0) |
        (tr >= threshold ? 2 : 0) |
        (br >= threshold ? 4 : 0) |
        (bl >= threshold ? 8 : 0);

      // 0 = all corners below threshold, 15 = all above → no isoline here
      if (idx === 0 || idx === 15) continue;

      const x = c * CELL_W;
      const y = r * CELL_H;
      // Crossing points along each edge, interpolated to threshold
      const top = `${(x + CELL_W * lerp(tl, tr, threshold)).toFixed(1)},${y.toFixed(1)}`;
      const right = `${(x + CELL_W).toFixed(1)},${(y + CELL_H * lerp(tr, br, threshold)).toFixed(1)}`;
      const bottom = `${(x + CELL_W * lerp(bl, br, threshold)).toFixed(1)},${(y + CELL_H).toFixed(1)}`;
      const left = `${x.toFixed(1)},${(y + CELL_H * lerp(tl, bl, threshold)).toFixed(1)}`;

      const line = (a: string, b: string) => parts.push(`M${a}L${b}`);
      switch (idx) {
        case 1:
        case 14:
          line(left, top);
          break;
        case 2:
        case 13:
          line(top, right);
          break;
        case 3:
        case 12:
          line(left, right);
          break;
        case 4:
        case 11:
          line(right, bottom);
          break;
        case 5:
          // Saddle — two separate segments. Disambiguating by always
          // picking the same diagonal is fine for a decorative pattern.
          line(left, top);
          line(right, bottom);
          break;
        case 6:
        case 9:
          line(top, bottom);
          break;
        case 7:
        case 8:
          line(left, bottom);
          break;
        case 10:
          line(left, bottom);
          line(top, right);
          break;
      }
    }
  }
  return parts.join("");
}

const PATHS: string[] = thresholds.map(buildContour);

export default function HeroTopo() {
  return (
    <svg
      className={styles.topo}
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      <g
        fill="none"
        stroke="var(--accent)"
        strokeWidth="1.1"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {PATHS.map((d, i) => (
          <path key={i} d={d} />
        ))}
      </g>
    </svg>
  );
}
