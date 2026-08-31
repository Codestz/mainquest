/**
 * `weather` — 'data'. Declared in the axis policy and never built until now.
 *
 * The last 30 days against the campaign baseline. Not a judgement: a quiet
 * month is fog, a busy one is clear, and neither is better. It is the only
 * element on the card that reflects the RECENT past rather than the whole
 * campaign, which is what stops a card from feeling frozen mid-year.
 */

import { W, type Theme } from '../theme.js';
import { clipRect, field } from './field.js';

export type Weather = 'clear' | 'drifting' | 'fog' | 'snow';

/**
 * Recent activity versus the campaign's own average.
 *
 * Compared against the user's OWN baseline, never against other people — the
 * card has no business telling someone they are below average at their job.
 */
export function readWeather(weeks: number[], campaignDay: number): Weather {
  const active = weeks.filter((_, i) => i * 7 <= campaignDay);
  if (active.length < 5) return 'clear';

  const recent = active.slice(-4);
  const recentMean = recent.reduce((a, b) => a + b, 0) / recent.length;
  const baseline = active.reduce((a, b) => a + b, 0) / active.length;
  if (baseline <= 0) return 'fog';

  const ratio = recentMean / baseline;
  if (ratio >= 1.15) return 'clear';
  if (ratio >= 0.6) return 'drifting';
  if (ratio >= 0.2) return 'fog';
  return 'snow';
}

/**
 * Drawn between the ridges and the ground, so it sits IN the scene rather than
 * over it. Everything that loops is small and slow — the animation budget says
 * anything running forever has to be cheap.
 */
export function weather(kind: Weather, th: Theme, y: number, animate: boolean): string {
  if (kind === 'clear') return '';

  const tint = th.name === 'dark' ? '#C6D4FF' : '#FFFFFF';

  if (kind === 'fog' || kind === 'drifting') {
    const bands = kind === 'fog' ? 3 : 2;
    const alpha = kind === 'fog' ? 0.16 : 0.08;
    let out = '';
    for (let i = 0; i < bands; i++) {
      const by = y - 16 + i * 13;
      out += `<rect x="0" y="${by}" width="${W}" height="7" fill="${tint}" opacity="${alpha}">`;
      if (animate) {
        // Slow horizontal drift, opposite directions per band for parallax.
        const dir = i % 2 === 0 ? 26 : -22;
        out += `<animateTransform attributeName="transform" type="translate" ` +
          `values="0 0; ${dir} 0; 0 0" dur="${22 + i * 7}s" repeatCount="indefinite"/>`;
      }
      out += `</rect>`;
    }
    return out;
  }

  /**
   * snow: a near-dormant campaign. Sparse, slow, and it settles.
   *
   * This was 26 `<rect>`s with 26 `<animateTransform>`s — which, on top of the
   * ~30 the rest of the card already spends, would have pushed a dormant
   * profile's card to 54 against a budget of 40. Three seamless scrolling
   * fields give MORE snow for three elements. See field.ts.
   */
  const y0 = y - 54;
  const H = 118;
  const id = 'sn';
  let out = `<defs>${clipRect(id, 0, y0, W, H)}</defs>`;
  const layers = [
    { count: 26, size: 1, opacity: 0.35, dx: 14, dur: 26 },
    { count: 18, size: 2, opacity: 0.55, dx: 22, dur: 17 },
    { count: 9, size: 3, opacity: 0.75, dx: 30, dur: 11 },
  ];
  layers.forEach((l, n) => {
    out += field(id, {
      x: 0, y: y0, w: W, h: H, count: l.count, size: l.size,
      colour: tint, opacity: l.opacity, dir: 'down', dx: l.dx,
      dur: l.dur, begin: n * 3, salt: 9001 + n * 37,
    }, animate);
  });
  return out;
}
