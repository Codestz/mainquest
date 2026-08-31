/**
 * Raw counts -> a comparable 0..1 vector. Pure. The output is what derive()
 * and the renderer both consume.
 *
 * THIS IS A SCALE, NOT A RANKING, and the difference is the whole reason the
 * card no longer prints a percentile.
 *
 * Eight metrics with incompatible units — commits run to five figures, streak
 * caps at 366, burst is a coefficient of variation x1000 — cannot be compared
 * by cosine until something maps them onto one range. That mapping is all this
 * module owes anybody. The stops that define it happen to have been measured
 * from a sample, because measured anchors are more sensible than invented
 * ones, but the number they produce is a POSITION ON A SCALE and must never be
 * shown to a user as a position among people.
 *
 * The claim was dropped rather than improved, because a bigger sample cannot
 * fix it. There is no neutral population to rank against: uniform over all
 * accounts is overwhelmingly dormant — under that frame `reviews` had
 * p50 = p90 = 0, a boolean wearing a percentile's clothes — so the frame has
 * to condition on activity, and every such condition is a choice. Sampling
 * harder would only measure an arbitrary frame more precisely, and precision
 * reads as authority.
 *
 * It also contradicted the product: a card whose premise is that it describes
 * how you work, not how much, has no business printing a how-much ranking.
 */

import table from '../data/percentiles.json' with { type: 'json' };
import type { Metric, Percentiles } from './derive.js';

export interface RawMetrics extends Record<Metric, number> {}

export interface Stops { p10: number; p25: number; p50: number; p75: number; p90: number; p99: number }

/** The metrics the model is defined over. The single source of truth here. */
export const METRICS: readonly Metric[] = [
  'commits', 'reviews', 'merges', 'streak', 'repos', 'issues', 'burst', 'weekend',
];

const STOPS = [10, 25, 50, 75, 90, 99] as const;

/**
 * `merges` has no stops of its own, so PRs *opened* stands in for PRs
 * *merged*.
 *
 * Still a real distortion, even now that no ranking is printed: `merges` is
 * being placed on a scale calibrated for a different and strictly larger
 * quantity, so everyone reads high on it. `close_the_loop` and the
 * `revolving_door` debuff exist precisely to measure the gap between opened
 * and merged. The card says so.
 *
 * Now that this table is a scale rather than a sample, the fix no longer
 * requires a sampling run at all — merges stops can simply be authored, the
 * same way any game's stat curve is.
 */
export const MERGES_IS_PROXY = !('merges' in table.metrics);

const metrics = table.metrics as unknown as Record<string, Stops>;

export const SCALE = {
  ...table,
  metrics: {
    ...metrics,
    merges: metrics['merges'] ?? metrics['prs']!,
  } as Record<Metric, Stops>,
};

/** True while the stops are invented rather than measured. */
export const IS_PLACEHOLDER = (SCALE as { generated: string }).generated === 'PLACEHOLDER';

/**
 * Where the scale stops being useful. The top stop is driven by a handful of
 * bot-like accounts (commits p99 = 17,535 against p90 = 489), so anchoring the
 * top of the scale there would squeeze every real user into almost none of it.
 * The table declares its own clamp.
 */
const CLAMP_AT = Number(
  String((SCALE as { tailClampedAt?: string }).tailClampedAt ?? 'p99').slice(1),
);

/**
 * Piecewise-linear interpolation between the published stops. Below the first
 * and above the clamp it saturates: the tails are where the stops are least
 * meaningful, and nothing on the card should depend on their shape.
 */
export function percentileOf(value: number, m: Stops): number {
  const pts: Array<[number, number]> = STOPS
    .filter((p) => p <= CLAMP_AT)
    .map((p) => [m[`p${p}`], p / 100]);
  const first = pts[0]!;
  const last = pts[pts.length - 1]!;

  if (value <= first[0]) return first[0] <= 0 ? 0 : first[1] * (value / first[0]);

  /**
   * Above the last trusted stop, COMPRESS — do not clamp.
   *
   * Hard-clamping to 1.0 was worse than the bot-inflated tail it was avoiding.
   * The sample's p90 for commits is 510, and anyone who installs this card
   * clears p90 on most metrics — so every active developer's vector went flat
   * near the top and every archetype scored alike. Measured: a 2,400-commit
   * committer and a 640-review reviewer, the two most opposite fixtures there
   * are, both classified `sentinel`.
   *
   * This saturates smoothly instead: it equals the last stop's percentile at
   * the stop, approaches 1.0 asymptotically, and stays strictly monotonic. So
   * 2,400 commits still outranks 640, while a bot at 17,535 cannot run away
   * with the scale.
   */
  if (value >= last[0]) {
    const [x, y] = last;
    if (x <= 0) return 1;
    return y + (1 - y) * (1 - Math.exp(-(value - x) / x));
  }

  for (let i = 1; i < pts.length; i++) {
    const [x1, y1] = pts[i]!;
    const [x0, y0] = pts[i - 1]!;
    if (value <= x1) {
      // A degenerate stop pair (x0 === x1) means the metric is flat here --
      // common for `reviews`, where most of the population sits at zero.
      if (x1 === x0) return y1;
      return y0 + ((value - x0) / (x1 - x0)) * (y1 - y0);
    }
  }
  return 1;
}

export function normalise(raw: RawMetrics): Percentiles {
  const out = {} as Percentiles;
  // Iterate the METRICS the model defines, not the caller's keys. Reading
  // `Object.keys(raw)` meant any extra field on the input — a `total`, a
  // `login` — was looked up in the distribution table and crashed on
  // undefined. The caller decides what to pass; the model decides what counts.
  for (const k of METRICS) {
    out[k] = Math.min(1, Math.max(0, percentileOf(raw[k] ?? 0, SCALE.metrics[k])));
  }
  return out;
}

/**
 * How much of the population sits on a single value. A metric where most of the
 * sample is zero cannot produce meaningful tiers -- it produces a boolean
 * wearing a percentile's clothes. Surfaced so the card can decline to claim a
 * tier it has not earned.
 */
export function isDegenerate(m: Metric): boolean {
  const s = SCALE.metrics[m];
  return s.p50 === s.p90;
}
