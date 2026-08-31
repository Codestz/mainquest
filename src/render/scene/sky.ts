/**
 * The sky: driven by day-of-campaign, not by anything about the user.
 *
 * `skyBand` is 'fixed' (the axis policy) — every card rendered on the same day
 * gets the same sky. That is what makes two people comparing cards in March
 * feel like they are in the same game.
 *
 * This file also owns the two axes that were DECLARED in the policy and never
 * built: `constellation` (data) and `starScatter` (fixed). They were listed as
 * owned, a test asserted every axis had an owner, and nothing asserted the
 * renderer actually drew one.
 */

import type { Theme } from '../theme.js';

/**
 * Four hand-picked seasonal palettes, switched DISCRETELY.
 *
 * Linear-mixing dawn orange toward night navy runs the midpoint through mud,
 * which is what the first render looked like. Four deliberate looks beat 365
 * muddy ones, and it keeps "three flat bands, never a gradient" honest.
 */
export function sky(day: number, th: Theme): readonly [string, string, string] {
  const q = Math.min(3, Math.max(0, Math.floor((day - 1) / 91.25)));
  return th.seasons[q]!;
}

/**
 * The moon or sun, by campaign progress.
 *
 * Rises across the sky as the year advances — left in January, overhead in
 * summer, right by December. Free: it is a function of the same day-of-campaign
 * the sky bands already use, so it is 'fixed' like they are, and two people
 * comparing cards in March see it in the same place.
 */
export function celestial(day: number, th: Theme, animate: boolean): string {
  const k = Math.min(1, Math.max(0, (day - 1) / 364));
  // Travels only across the open sky BETWEEN the two top windows. The first
  // version spanned the full width and spent half the year hidden behind the
  // ability panel, which is a worse bug than not having a moon: it looked like
  // a rendering fault rather than a design.
  const x = Math.round(360 + k * 170);
  const y = Math.round(104 - Math.sin(k * Math.PI) * 52);
  const day2 = th.name === 'light';
  const body = day2 ? '#FFE9A8' : '#E8E4CE';
  const glow = day2 ? '#FFF4CC' : '#C9D4F0';

  let out = `<circle cx="${x}" cy="${y}" r="26" fill="${glow}" opacity=".12"/>`;
  out += `<circle cx="${x}" cy="${y}" r="14" fill="${body}"/>`;
  if (!day2) {
    // Craters — three flat dots, no gradients.
    out += `<circle cx="${x - 4}" cy="${y - 3}" r="3" fill="${glow}" opacity=".45"/>` +
      `<circle cx="${x + 5}" cy="${y + 2}" r="2" fill="${glow}" opacity=".4"/>` +
      `<circle cx="${x + 1}" cy="${y + 7}" r="1.5" fill="${glow}" opacity=".35"/>`;
  }
  if (animate) {
    out = `<g><animate attributeName="opacity" values=".85;1;.85" dur="9s" ` +
      `repeatCount="indefinite"/>${out}</g>`;
  }
  return out;
}

/**
 * `starScatter` — 'fixed', so every card has the SAME background stars.
 *
 * Deliberately not seeded. Two star systems on one canvas is the ambiguity that
 * breaks the ornament/measurement rule: if scatter varied per login, no viewer
 * could tell which stars are the constellation that actually means something.
 * Freeze the scatter; let only meaning move.
 */
export function starScatter(th: Theme, animate: boolean): string {
  /**
   * Only a THIRD of the stars twinkle.
   *
   * The card is capped at 40 animated elements, and 22 twinkling stars
   * spent more than half that budget on the least meaningful thing on the
   * canvas. A sky where every star pulses also reads as noise — real ones
   * mostly sit still. The rest are drawn as one static path, which costs a
   * single element instead of 15.
   */
  const still: string[] = [];
  let out = '';
  for (let n = 0; n < 22; n++) {
    const x = (n * 137) % 860;
    const y = 14 + ((n * 53) % 150);
    const d = (n % 5 === 0 ? 2 : 1) + 1;
    if (animate && n % 3 === 0) {
      out += `<rect x="${x}" y="${y}" width="${d}" height="${d}" fill="${th.star}" opacity=".5">` +
        `<animate attributeName="opacity" values=".2;.8;.2" dur="${3 + (n % 4)}s" ` +
        `begin="${(n * 0.4).toFixed(1)}s" repeatCount="indefinite"/></rect>`;
    } else {
      still.push(`M${x} ${y}h${d}v${d}h-${d}z`);
    }
  }
  if (still.length) {
    out += `<path d="${still.join('')}" fill="${th.star}" opacity=".5"/>`;
  }
  return out;
}

/**
 * `constellation` — 'data'. Your peak weeks, written in the sky.
 *
 * The brightest handful of weeks in the campaign become stars, joined in order
 * by thin lines. Unlike the scatter behind it these MEAN something, which is
 * why the scatter is frozen: one starfield carries signal, the other is wall.
 *
 * Drawn brighter and larger than the scatter so the distinction is visible
 * rather than merely true.
 */
export function constellation(weeks: number[], th: Theme, animate: boolean): string {
  const ranked = weeks
    .map((v, i) => ({ v, i }))
    .filter((d) => d.v > 0)
    .sort((a, b) => b.v - a.v)
    .slice(0, 7)
    .sort((a, b) => a.i - b.i);
  if (ranked.length < 2) return '';

  const max = Math.max(...ranked.map((d) => d.v), 1);
  const pts = ranked.map((d) => ({
    x: Math.round(60 + (d.i / Math.max(weeks.length - 1, 1)) * 760),
    y: Math.round(150 - (d.v / max) * 96),
    v: d.v,
  }));

  let out = `<polyline points="${pts.map((p) => `${p.x},${p.y}`).join(' ')}" ` +
    `fill="none" stroke="${th.star}" stroke-width="1" opacity=".28"/>`;

  pts.forEach((p, n) => {
    const r = 2 + Math.round((p.v / max) * 2);
    out += `<circle cx="${p.x}" cy="${p.y}" r="${r}" fill="${th.star}" opacity=".9">`;
    // Only the three biggest weeks pulse — the rest hold. Same budget logic as
    // the scatter, and it makes the peaks read as peaks.
    if (animate && r >= 3) {
      out += `<animate attributeName="opacity" values=".55;1;.55" dur="${4 + (n % 3)}s" ` +
        `begin="${(n * 0.7).toFixed(1)}s" repeatCount="indefinite"/>`;
    }
    out += `</circle>`;
  });
  return out;
}
