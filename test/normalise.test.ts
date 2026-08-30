import { describe, expect, it } from 'vitest';
import { normalise, percentileOf, DISTRIBUTION, IS_PLACEHOLDER, isDegenerate } from '../src/normalise.js';
import type { Metric } from '../src/derive.js';

const METRICS: Metric[] = ['commits', 'reviews', 'merges', 'streak', 'repos', 'issues'];

describe('the distribution table', () => {
  it('covers every metric derive() consumes', () => {
    for (const m of METRICS) expect(DISTRIBUTION.metrics[m], m).toBeDefined();
  });

  it('is monotonic at every stop', () => {
    // A non-monotonic table silently inverts a tier. Cheap to assert, and the
    // table is regenerated quarterly by a script nobody will re-read.
    for (const m of METRICS) {
      const s = DISTRIBUTION.metrics[m]!;
      const vals = [s.p10, s.p25, s.p50, s.p75, s.p90, s.p99];
      for (let i = 1; i < vals.length; i++) {
        expect(vals[i]!, `${m} p-stop ${i}`).toBeGreaterThanOrEqual(vals[i - 1]!);
      }
    }
  });

  it('records how it was conditioned', () => {
    expect(IS_PLACEHOLDER).toBe(false);
    // Deliberately low: the shipped table is the repo-contributor PILOT
    // (n=82). Frame correctness beat sample size — see the file's `caveat`.
    expect(DISTRIBUTION.sampleSize).toBeGreaterThan(50);
    expect(DISTRIBUTION.frame).toBeTruthy();
    expect(DISTRIBUTION.minActivity).toBeGreaterThan(0);
  });

  it('has a non-degenerate reviews distribution', () => {
    // This is why the sampling frame was changed. Under the uniform-account
    // frame, reviews had p50 = p90 = 0 — a boolean wearing a percentile's
    // clothes, with second_opinion, healer and the seniority rank all built on
    // it. Sampling repo contributors instead makes it a real scale.
    expect(isDegenerate('reviews')).toBe(false);
  });
});

describe('percentileOf', () => {
  const stops = { p10: 10, p25: 25, p50: 50, p75: 100, p90: 200, p99: 900 };

  it('lands on the published stops', () => {
    expect(percentileOf(50, stops)).toBeCloseTo(0.5, 2);
    expect(percentileOf(100, stops)).toBeCloseTo(0.75, 2);
  });

  it('saturates at the clamp the table declares', () => {
    // The table declares tailClampedAt: p90 because at n=82 the top stop is a
    // handful of bot-like accounts (commits p99 = 17,535 vs p90 = 489).
    // Clamping there keeps the scale spread across real users.
    expect(percentileOf(200, stops)).toBe(1);
    expect(percentileOf(900, stops)).toBe(1);
  });

  it('interpolates between them', () => {
    const mid = percentileOf(75, stops);
    expect(mid).toBeGreaterThan(0.5);
    expect(mid).toBeLessThan(0.75);
  });

  it('clamps both tails', () => {
    // The tails are where a sampled table lies most; nothing on the card
    // should depend on their shape.
    expect(percentileOf(0, stops)).toBe(0);
    expect(percentileOf(50_000, stops)).toBe(1);
  });

  it('never leaves 0..1', () => {
    const p = normalise({ commits: 9e9, reviews: 0, merges: 0, streak: 0, repos: 0, issues: 0 });
    for (const m of METRICS) {
      expect(p[m], m).toBeGreaterThanOrEqual(0);
      expect(p[m], m).toBeLessThanOrEqual(1);
    }
  });
});
