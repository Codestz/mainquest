import { describe, expect, it } from 'vitest';
import { classify, rank, debuffs, type Percentiles } from '../src/derive.js';
import { campaignSeed, streamForAxis, seal } from '../src/identity/index.js';

const heavyReviewer: Percentiles = {
  commits: 0.3, reviews: 0.95, merges: 0.5, streak: 0.5, repos: 0.5, issues: 0.8,
  burst: 0.4, weekend: 0.3,
};

describe('toolchain smoke', () => {
  it('classifies a heavy reviewer as healer', () => {
    expect(classify(heavyReviewer)[0]).toBe('healer');
  });

  it('ranks on reviews-given vs prs-opened', () => {
    expect(rank(300, 20, 8)).toBe('archon');
    expect(rank(0, 40, 1)).toBe('apprentice');
  });

  it('flags the lone wolf', () => {
    expect(debuffs({ ...heavyReviewer, commits: 0.9, reviews: 0.05 })).toContain('lone_wolf');
  });

  // Determinism rule: same input -> byte-identical output.
  it('derives a stable seed and stream per login+campaign', () => {
    const a = campaignSeed('codestz', 2026);
    expect(campaignSeed('codestz', 2026)).toBe(a);
    expect(campaignSeed('CodeStz', 2026)).toBe(a);      // case-insensitive
    expect(campaignSeed('codestz', 2027)).not.toBe(a);  // campaign-scoped
    const draw = () => Array.from({ length: 3 }, streamForAxis('codestz', 2026, 'sigil'));
    expect(draw()).toEqual(draw());
    expect(seal(a)).toMatch(/^[0-9A-Z]{8}$/);
  });
});
