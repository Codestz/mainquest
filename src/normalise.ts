/**
 * Raw counts -> percentile vector, against the sampled distribution.
 * Pure. The output is what derive() and the renderer both consume.
 */

import table from '../data/percentiles.json' with { type: 'json' };
import type { Metric, Percentiles } from './derive.js';

export interface RawMetrics extends Record<Metric, number> {}

export interface Stops { p10: number; p25: number; p50: number; p75: number; p90: number; p99: number }

const STOPS = [10, 25, 50, 75, 90, 99] as const;

/**
 * `merges` is not in the sampled table: it needs one `search(is:merged)` call
 * per user (docs/02 Tier 1) and search is rate-limited separately at 30/min.
 * Until that pass runs, PRs *opened* stands in for PRs *merged*.
 *
 * This is a real distortion, not a rounding error — `close_the_loop` and the
 * `revolving_door` debuff exist precisely to measure the gap between opened and
 * merged, so a proxy that equates them flatters everyone. The card says so.
 */
export const MERGES_IS_PROXY = !('merges' in table.metrics);

const metrics = table.metrics as unknown as Record<string, Stops>;

export const DISTRIBUTION = {
  ...table,
  metrics: {
    ...metrics,
    merges: metrics['merges'] ?? metrics['prs']!,
  } as Record<Metric, Stops>,
};

/** True while the distribution is invented rather than sampled. */
export const IS_PLACEHOLDER = (DISTRIBUTION as { generated: string }).generated === 'PLACEHOLDER';

/**
 * Where the table stops being trustworthy. At the current sample size the top
 * stop is driven by a handful of bot-like accounts (commits p99 = 17,535
 * against p90 = 489), so clamping at p99 would spread most real users across
 * almost none of the scale. The table declares its own clamp.
 */
const CLAMP_AT = Number(
  String((DISTRIBUTION as { tailClampedAt?: string }).tailClampedAt ?? 'p99').slice(1),
);

/**
 * Piecewise-linear interpolation between the published stops. Below p10 and
 * above the clamp it saturates: the tails are where a sampled table lies most,
 * and nothing on the card should depend on their shape.
 */
export function percentileOf(value: number, m: Stops): number {
  const pts: Array<[number, number]> = STOPS
    .filter((p) => p <= CLAMP_AT)
    .map((p) => [m[`p${p}`], p / 100]);
  const first = pts[0]!;
  const last = pts[pts.length - 1]!;
  if (value <= first[0]) return first[0] <= 0 ? 0 : first[1] * (value / first[0]);
  if (value >= last[0]) return 1;
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
  for (const k of Object.keys(raw) as Metric[]) {
    out[k] = Math.min(1, Math.max(0, percentileOf(raw[k], DISTRIBUTION.metrics[k])));
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
  const s = DISTRIBUTION.metrics[m];
  return s.p50 === s.p90;
}
