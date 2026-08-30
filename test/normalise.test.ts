import { describe, expect, it } from 'vitest';
import { normalise, percentileOf, DISTRIBUTION, IS_PLACEHOLDER, isDegenerate } from '../src/normalise.js';
import { hasSignal, classMargin, standing, type Metric } from '../src/derive.js';

const METRICS: Metric[] = [
  'commits', 'reviews', 'merges', 'streak', 'repos', 'issues', 'burst', 'weekend',
];

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
    const p = normalise({ commits: 9e9, reviews: 0, merges: 0, streak: 0, repos: 0, issues: 0, burst: 0, weekend: 0 });
    for (const m of METRICS) {
      expect(p[m], m).toBeGreaterThanOrEqual(0);
      expect(p[m], m).toBeLessThanOrEqual(1);
    }
  });
});

describe('the empty state', () => {
  const flat = normalise({
    commits: 0, reviews: 0, merges: 0, streak: 0, repos: 0, issues: 0, burst: 0, weekend: 0,
  });

  it('carries no signal, so it is not classified', () => {
    // Centred cosine measures SHAPE, so a flat vector scores 0/0 against every
    // archetype and the sort returns whichever is first in the list. That
    // labelled the empty-account fixture `berserker` — the extreme
    // high-volume class. The card must decline instead.
    expect(hasSignal(flat)).toBe(false);
  });

  it('still classifies a vector with real shape', () => {
    const shaped = normalise({
      commits: 2400, reviews: 18, merges: 90, streak: 140, repos: 6, issues: 20,
      burst: 1400, weekend: 120,
    });
    expect(hasSignal(shaped)).toBe(true);
    expect(classMargin(shaped)).toBeGreaterThan(0);
  });
});

describe('standing — what the card may claim', () => {
  const shaped = normalise({
    commits: 639, reviews: 0, merges: 40, streak: 12, repos: 8, issues: 0,
    burst: 1029, weekend: 445,
  });
  const sliver = normalise({
    commits: 3, reviews: 1, merges: 0, streak: 6, repos: 1, issues: 0,
    burst: 731, weekend: 6,
  });

  it('classes an account whose work is mostly public', () => {
    expect(standing(shaped, { sealed: 156, total: 844 })).toBe('classed');
  });

  it('withholds the class when the work is mostly sealed', () => {
    // A real account: 1,395 private against 3 commits and 1 review. The card
    // called it `healer` on the strength of that single review — 0.3% of the
    // work it actually did. Confidently wrong is worse than empty.
    expect(standing(sliver, { sealed: 1395, total: 1400 })).toBe('sealed');
  });

  it('is unclassed only when there is nothing at all', () => {
    const flat = normalise({
      commits: 0, reviews: 0, merges: 0, streak: 0, repos: 0, issues: 0, burst: 0, weekend: 0,
    });
    expect(standing(flat, { sealed: 0, total: 0 })).toBe('unclassed');
  });

  it('does not seal an account that is simply quiet in public', () => {
    // Low volume is not the same as hidden: 40 of 50 visible still classes.
    expect(standing(shaped, { sealed: 10, total: 50 })).toBe('classed');
  });
});
