/**
 * The sky: driven by day-of-campaign, not by anything about the user.
 *
 * `skyBand` is 'fixed' (docs/07#7) — every card rendered on the same day gets
 * the same sky. That is what makes two people comparing cards in March feel
 * like they are in the same game.
 */

/**
 * Bands run top -> horizon. Each palette darkens upward, so the sky sits behind
 * the windows rather than competing with them.
 *
 * Q3 was `#8C4A2E / #A85C52 / #5E4272` and read as flat brown: a mid-value
 * orange at full saturation across the largest band on the card. Real dusk is
 * dark overhead and warm only at the horizon, so the value range is what makes
 * it read, not the hue. Same correction applied to Q1.
 */
import type { Theme } from '../theme.js';

/**
 * Four hand-picked seasonal palettes, switched DISCRETELY.
 *
 * Linear-mixing dawn orange toward night navy runs the midpoint through mud,
 * which is what the first render looked like. Four deliberate looks beat 365
 * muddy ones, and it keeps docs/04's "three flat bands, never a gradient"
 * rule honest.
 */
export function sky(day: number, th: Theme): readonly [string, string, string] {
  const q = Math.min(3, Math.max(0, Math.floor((day - 1) / 91.25)));
  return th.seasons[q]!;
}
