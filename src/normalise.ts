/**
 * Raw counts -> percentile vector, against the static distribution table.
 * Pure. The output is what derive() and the renderer both consume.
 */

import table from '../data/percentiles.placeholder.json' with { type: 'json' };
import type { Metric, Percentiles } from './derive.js';

export interface RawMetrics extends Record<Metric, number> {}

const STOPS = [10, 25, 50, 75, 90, 99] as const;

/**
 * Piecewise-linear interpolation between the published percentile stops.
 * Below p10 and above p99 it clamps, because the tails are where an invented
 * table lies most and nothing on the card should depend on their shape.
 */
export function percentileOf(value: number, m: Record<string, number>): number {
  const pts: Array<[number, number]> = STOPS.map((p) => [m[`p${p}`] ?? 0, p / 100]);
  const first = pts[0]!;
  const last = pts[pts.length - 1]!;
  if (value <= first[0]) return first[1] * (value / Math.max(first[0], 1));
  if (value >= last[0]) return 1;
  for (let i = 1; i < pts.length; i++) {
    const [x1, y1] = pts[i]!;
    const [x0, y0] = pts[i - 1]!;
    if (value <= x1) {
      const t = (value - x0) / Math.max(x1 - x0, 1);
      return y0 + t * (y1 - y0);
    }
  }
  return 1;
}

export function normalise(raw: RawMetrics): Percentiles {
  const out = {} as Percentiles;
  for (const k of Object.keys(raw) as Metric[]) {
    out[k] = Math.min(1, Math.max(0, percentileOf(raw[k], table.metrics[k])));
  }
  return out;
}

/** True while the distribution is invented. The card says so out loud. */
export const PERCENTILES_ARE_PLACEHOLDER = table.generated === 'PLACEHOLDER';
