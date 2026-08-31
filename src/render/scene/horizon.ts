/**
 * The horizon IS your year.
 *
 * Twelve monthly totals become a mountain ridge, so no two people share a
 * skyline. It was one flat polygon; it is now three ridges at different depths
 * plus treeline, which is what turns a shape into a place.
 *
 * Only the front ridge carries the data. The two behind are derived from it —
 * shifted and flattened — so the parallax reads as distance rather than as
 * three unrelated charts stacked up.
 */

import { W, type Theme } from '../theme.js';

/** Monthly totals from 52-ish weekly ones. */
function months(weeks: number[]): number[] {
  return Array.from({ length: 12 }, (_, m) => {
    const slice = weeks.slice(
      Math.floor((m * weeks.length) / 12),
      Math.floor(((m + 1) * weeks.length) / 12),
    );
    return slice.reduce((a, b) => a + b, 0);
  });
}

/** Mix two hex colours — used to fade the far ridges toward the sky. */
function mix(a: string, b: string, t: number): string {
  const parse = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const [r1, g1, b1] = parse(a);
  const [r2, g2, b2] = parse(b);
  const c = (x: number, y: number) =>
    Math.round(x + (y - x) * t).toString(16).padStart(2, '0');
  return `#${c(r1!, r2!)}${c(g1!, g2!)}${c(b1!, b2!)}`;
}

function ridge(vals: number[], baseY: number, height: number, colour: string): string {
  const max = Math.max(...vals, 1);
  const pts = vals.map((v, i) => {
    const x = Math.round((i / Math.max(vals.length - 1, 1)) * W);
    return `${x},${Math.round(baseY - (v / max) * height)}`;
  });
  return `<polygon points="0,420 ${pts.join(' ')} ${W},420" fill="${colour}"/>`;
}

/**
 * A few conifers along the front ridge.
 *
 * Placed from the ridge itself rather than randomly, so they sit ON the
 * skyline instead of floating near it — and so they are as deterministic as
 * everything else on the card.
 */
function trees(vals: number[], baseY: number, height: number, colour: string): string {
  const max = Math.max(...vals, 1);
  let out = '';
  for (let i = 0; i < vals.length; i++) {
    const v = vals[i]!;
    if (v === 0) continue;
    const x = Math.round((i / Math.max(vals.length - 1, 1)) * W);
    const y = Math.round(baseY - (v / max) * height);
    // Two trees per month, offset either side of the sample point.
    for (const [dx, scale] of [[-16, 1], [13, 0.75]] as const) {
      const h = Math.round(11 * scale);
      const w = Math.round(5 * scale);
      out += `<polygon points="${x + dx},${y} ${x + dx - w},${y + h} ${x + dx + w},${y + h}" ` +
        `fill="${colour}"/>` +
        `<rect x="${x + dx - 1}" y="${y + h - 1}" width="2" height="3" fill="${colour}"/>`;
    }
  }
  return out;
}

export function horizon(weeks: number[], baseY: number, th: Theme): string {
  const m = months(weeks);
  const skyward = th.seasons[Math.min(3, 2)]![2];

  // Far ridges: the same year, flattened and phase-shifted. Derived rather
  // than invented, so the whole skyline stays one landscape.
  const far = m.map((_, i) => m[(i + 4) % 12]! * 0.55 + m[(i + 7) % 12]! * 0.25);
  const mid = m.map((_, i) => m[(i + 2) % 12]! * 0.75 + m[i]! * 0.2);

  return (
    ridge(far, baseY - 26, 34, mix(th.mountain, skyward, 0.55)) +
    ridge(mid, baseY - 13, 46, mix(th.mountain, skyward, 0.28)) +
    ridge(m, baseY, 58, th.mountain) +
    trees(m, baseY, 58, mix(th.mountain, '#000000', 0.35))
  );
}
