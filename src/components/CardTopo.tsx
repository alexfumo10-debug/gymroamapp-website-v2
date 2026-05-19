/**
 * Card-scoped topographic background. Same marching-squares noise
 * approach as HeroTopo, but generated at a smaller viewBox + lower
 * opacity tuned for the smaller card surface.
 *
 * Positioned absolute / inset: 0 so it fills whatever GlowCard it
 * lives inside. Content stacks on top via z-index. The mask is
 * intentionally absent (uniform low opacity) — masking the center on
 * a tile this small would just hide most of the pattern.
 *
 * The path data is computed once at module load; all card instances
 * render the same SVG markup (deterministic, no hydration drift).
 */

import styles from "./CardTopo.module.css";

const W = 800;
const H = 600;
const COLS = 44;
const ROWS = 32;
const CONTOUR_COUNT = 12;

const CELL_W = W / COLS;
const CELL_H = H / ROWS;

/** Same sum-of-sines noise as HeroTopo, with a different phase offset
    so the card pattern reads as a distinct slice of the same family. */
function noise(nx: number, ny: number): number {
  return (
    Math.sin(nx * 2.1 + 1.4) * Math.cos(ny * 1.9 + 0.7) +
    Math.sin(nx * 3.7 + ny * 2.4 + 2.0) * 0.7 +
    Math.cos(nx * 5.1 - ny * 3.6 + 0.3) * 0.5 +
    Math.sin(nx * 8.0 + ny * 6.1 + 1.1) * 0.3
  );
}

const grid: number[][] = [];
let minVal = Infinity;
let maxVal = -Infinity;
for (let r = 0; r <= ROWS; r++) {
  const row: number[] = [];
  for (let c = 0; c <= COLS; c++) {
    const v = noise((c / COLS) * 5, (r / ROWS) * 3.6);
    row.push(v);
    if (v < minVal) minVal = v;
    if (v > maxVal) maxVal = v;
  }
  grid.push(row);
}

const thresholds: number[] = [];
for (let i = 0; i < CONTOUR_COUNT; i++) {
  thresholds.push(minVal + ((i + 0.5) / CONTOUR_COUNT) * (maxVal - minVal));
}

function lerp(a: number, b: number, t: number): number {
  return (t - a) / (b - a);
}

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
      if (idx === 0 || idx === 15) continue;

      const x = c * CELL_W;
      const y = r * CELL_H;
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

export default function CardTopo() {
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
        strokeWidth="1"
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
