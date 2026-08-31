/**
 * The contribution grid, drawn as ground rather than as a chart.
 *
 * Emitted as ONE PATH PER SHADE, not one rect per cell.
 *
 * The first version wrote 208 `<rect>` elements — four rows of 52 weeks — and
 * that was 15.7 KB, 41.6% of the entire card, against a 40 KB hard limit. Every
 * other feature was competing for the 2 KB that left.
 *
 * Cells of the same shade are just subpaths of one `<path>`, so the per-element
 * overhead (`<rect x=".." y=".." width=".." height=".." fill=".."/>` ≈ 60 bytes)
 * collapses to about 16 bytes of path data per cell. Identical pixels, a
 * quarter of the bytes.
 *
 * The per-row opacity fade went with it: it cost a separate group per row and
 * was barely visible over the shade ramp that was already doing the work.
 */

import type { Theme } from '../theme.js';

const CELL_W = 15;
const CELL_H = 9;
const STEP_X = 16;
const STEP_Y = 10;
const ROWS = 4;

export function terrain(
  weeks: number[], x0: number, y0: number, th: Theme,
  motion: { animate: boolean } = { animate: true },
): string {
  const max = Math.max(...weeks, 1);

  // One subpath list per shade. Index 0 is the empty ground.
  const byShade: string[][] = [[], [], [], []];

  weeks.forEach((v, i) => {
    const level = v === 0 ? 0 : Math.min(3, Math.floor((v / max) * 3) + 1);
    const x = x0 + i * STEP_X;
    for (let r = 0; r < ROWS; r++) {
      // Rows below the first step down one shade, so the ground reads as
      // depth rather than as four identical stripes.
      const shade = Math.max(0, Math.min(3, level - (r > 1 ? 1 : 0)));
      byShade[shade]!.push(`M${x} ${y0 + r * STEP_Y}h${CELL_W}v${CELL_H}h-${CELL_W}z`);
    }
  });

  const paths = byShade
    .map((subpaths, shade) =>
      subpaths.length ? `<path d="${subpaths.join('')}" fill="${th.terrain[shade]}"/>` : '')
    .join('');

  // The ground builds under the character's feet on load, then freezes. A
  // still card has already finished doing that.
  return motion.animate
    ? `<g>${paths}<animate attributeName="opacity" from="0" to="1" dur="0.9s" fill="freeze"/></g>`
    : `<g>${paths}</g>`;
}
