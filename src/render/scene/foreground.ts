/**
 * The near edge of the landscape, and the things crossing it.
 *
 * The scene had a background (ridges, trees, sky) and a middle ground (the
 * contribution grid the character stands on) and then nothing in front. That
 * is what made the card read flat: with no near layer, the eye has no
 * parallax to infer depth from, and the character sits ON the picture rather
 * than IN it.
 *
 * Like the far ridges in horizon.ts, the near bank is DERIVED from the same
 * monthly totals rather than invented — heavily flattened, phase-shifted the
 * other way. One landscape, sampled at four depths.
 */

import { W, type Theme } from '../theme.js';

/**
 * A fixed undulation added under the derived shape.
 *
 * A dormant profile has twelve zero months, so the derived lip was a
 * pixel-perfect horizontal rule the full width of the card — with a bright
 * stroke on it, which is the single most artificial thing the renderer has
 * ever drawn. Ground is never flat. This guarantees a few pixels of wobble no
 * matter what the data does, and is far too small to read as signal.
 */
const WAVE = [0, -2, -3, -2, 0, 2, 3, 2, 0, -2, -3, -1] as const;

function months(weeks: number[]): number[] {
  return Array.from({ length: 12 }, (_, m) => {
    const slice = weeks.slice(
      Math.floor((m * weeks.length) / 12),
      Math.floor(((m + 1) * weeks.length) / 12),
    );
    return slice.reduce((a, b) => a + b, 0);
  });
}

function shade(hex: string, t: number): string {
  const p = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return `#${p.map((c) => Math.round(c * t).toString(16).padStart(2, '0')).join('')}`;
}

/**
 * The bank in front of the grid.
 *
 * Only ~36px of it is ever visible before the description window covers the
 * rest, so it is a silhouette and a fringe of grass — no interior detail,
 * which would be spent on pixels nobody sees.
 */
export function foreground(weeks: number[], topY: number, th: Theme): string {
  const m = months(weeks);
  const max = Math.max(...m, 1);
  // Flattened hard: this is a bank a few metres away, not a mountain range.
  // Undulation of ~14px reads as ground; the ridge's 58px would read as a
  // second skyline drawn upside down at the bottom of the card.
  const near = m.map((_, i) => m[(11 - i) % 12]! * 0.6 + m[(i + 5) % 12]! * 0.4);

  /**
   * The lip never rises above the grid's bottom edge.
   *
   * The first version undulated through it, and the bank ate the last row of
   * the contribution grid wherever it peaked — a near layer occluding a far
   * one is correct perspective but wrong priority: the grid is the data.
   */
  const pts = near.map((v, i) => {
    const x = Math.round((i / 11) * W);
    return [x, Math.round(topY + 10 - (v / max) * 10) + WAVE[i]!] as const;
  });

  const dark = shade(th.mountain, th.name === 'dark' ? 0.52 : 0.6);
  const lip = shade(th.terrain[2]!, th.name === 'dark' ? 0.7 : 0.85);

  const edge = pts.map(([x, y]) => `${x},${y}`).join(' ');
  let out = `<polygon points="0,420 ${edge} ${W},420" fill="${dark}"/>`;

  /**
   * A lit lip, not a fringe of blades.
   *
   * The first version drew a 1px triangle every 11px along the edge. At this
   * scale that is not grass — it is a dotted comb, and the gaps between the
   * teeth showed the ridge behind as a purple sawtooth stripe. Grass at 6px
   * has to be suggested, not drawn: a bright rim line for the lit edge, and a
   * handful of real TUFTS (three blades clustered) to break its silhouette.
   */
  out += `<polyline points="${edge}" fill="none" stroke="${lip}" ` +
    `stroke-width="2" opacity=".8"/>`;

  const tufts: string[] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, y0] = pts[i]!;
    const [x1, y1] = pts[i + 1]!;
    for (let k = 0; k < 3; k++) {
      const t = (k + 0.5) / 3;
      const x = Math.round(x0 + (x1 - x0) * t);
      const y = Math.round(y0 + (y1 - y0) * t) + 1;
      // Three blades, centre tallest — the shape reads as a clump even when
      // it is nine pixels of ink.
      const hgt = 5 + ((i * 5 + k * 3) % 3);
      tufts.push(
        `M${x - 3} ${y}l1 -${hgt - 2}l1 ${hgt - 2}z` +
        `M${x} ${y}l1 -${hgt}l1 ${hgt}z` +
        `M${x + 3} ${y}l1 -${hgt - 3}l1 ${hgt - 3}z`);
    }
  }
  return out + `<path d="${tufts.join('')}" fill="${dark}"/>`;
}

/**
 * A flock crossing the open sky.
 *
 * Drawn in the sky layer, so it passes BEHIND the two menu windows — which is
 * the whole reason it reads as distance rather than as a sticker. One path,
 * one animated element for the entire flock.
 *
 * Birds do not fly in fog or snow. That is not a flourish: it keeps the
 * weather axis honest, and it means the element budget is spent on whichever
 * of the two is actually saying something.
 */
export function birds(th: Theme, animate: boolean): string {
  const ink = th.name === 'dark' ? th.star : '#3B4256';
  // Five chevrons in a loose V, so the flock has a leader.
  const flock: Array<readonly [number, number, number]> = [
    [0, 0, 5], [-13, 7, 4], [13, 6, 4], [-25, 13, 3], [26, 12, 3],
  ];
  const d = flock
    .map(([dx, dy, s]) => `M${dx} ${dy}l${s} -${s - 1}l${s} ${s - 1}`)
    .join('');

  let out = `<g opacity=".55"><g transform="translate(-80 96)">`;
  if (animate) {
    // Starts off-canvas and ends off-canvas, so there is no pop at the loop.
    out += `<animateTransform attributeName="transform" type="translate" ` +
      `values="-80 96; 960 62" dur="54s" repeatCount="indefinite"/>`;
  }
  out += `<path d="${d}" fill="none" stroke="${ink}" stroke-width="1.5" ` +
    `stroke-linecap="square"/></g></g>`;
  return out;
}
