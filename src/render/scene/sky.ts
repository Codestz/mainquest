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
const SEASONS: ReadonlyArray<readonly [string, string, string]> = [
  ['#2A2350', '#5A3E6F', '#B8705E'], // Q1  cold dawn
  ['#1E4E7A', '#3F7FA8', '#7FB8CE'], // Q2  clear day
  ['#2B2350', '#6B3A5C', '#C4703F'], // Q3  dusk
  ['#141B4D', '#1E2A6B', '#34367F'], // Q4  deep night (docs/04 reference)
];

export function sky(day: number): readonly [string, string, string] {
  const q = Math.min(3, Math.max(0, Math.floor((day - 1) / 91.25)));
  return SEASONS[q]!;
}
