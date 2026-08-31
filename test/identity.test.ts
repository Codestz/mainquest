import { describe, expect, it } from 'vitest';
import {
  AXES, MEASURED_ADJACENT, SEED_SCOPE, seedPolicy, seededAxes,
  identitySeed, campaignSeed, streamForAxis, laneFor, pick, seal,
  frozenTable, drawFrom, SIGIL_DIMENSIONS, sigilSpace, expectedCollisions,
  drawFlourish, FLOURISHES, type Source,
} from '../src/identity/index.js';
import { sigilCombinations } from '../src/render/sigil/index.js';

const policy = seedPolicy();

describe('seedPolicy — the ornament/measurement boundary', () => {
  it('gives every axis exactly one owner', () => {
    // Record<Axis, Source> already fails to compile on a missing key; this
    // catches the reverse -- a key in the table that is no longer an axis.
    expect(Object.keys(policy).sort()).toEqual([...AXES].sort());
    for (const axis of AXES) {
      expect(['seed', 'data', 'fixed'] as Source[]).toContain(policy[axis]);
    }
  });

  it('keeps window chrome identical for every user', () => {
    expect(policy.windowChrome).toBe('fixed');
  });

  it('never lets ornament sit next to a `mide:` line (VISION)', () => {
    for (const axis of MEASURED_ADJACENT) expect(policy[axis]).toBe('data');
  });

  it('keeps one star system meaningful by freezing the other', () => {
    // If both varied, no viewer could tell which stars carry signal.
    expect(policy.constellation).toBe('data');
    expect(policy.starScatter).not.toBe('seed');
  });

  it('leaves enough seeded axes to actually differentiate a card', () => {
    expect(seededAxes().length).toBeGreaterThanOrEqual(4);
  });
});

describe('seed', () => {
  const a = campaignSeed('codestz', 2026);

  it('is stable, case-insensitive and campaign-scoped', () => {
    expect(campaignSeed('CodeStz', 2026)).toBe(a);
    expect(campaignSeed('codestz', 2027)).not.toBe(a);
    expect(seal(a)).toMatch(/^[0-9A-Z]{8}$/);
  });

  it('is 64-bit, so collisions stay negligible at any real user count', () => {
    expect(a).toBeLessThan(1n << 64n);
    expect(a).toBeGreaterThan(1n << 32n); // not a widened 32-bit value
  });

  it('picks deterministically from a table', () => {
    const table = ['argent', 'azure', 'gules', 'sable'] as const;
    const draw = () => {
      const rnd = streamForAxis('codestz', 2026, 'sigil');
      return [pick(rnd, table), pick(rnd, table), pick(rnd, table)];
    };
    expect(draw()).toEqual(draw());
  });

  it('gives each axis an independent lane', () => {
    // The point: adding a draw to one axis must not shift any other axis.
    const lanes = ['sigil', 'paletteDrift', 'spriteAccessory', 'seal']
      .map((ax) => laneFor(a, ax));
    expect(new Set(lanes).size).toBe(lanes.length);

    const palette = () => Array.from({ length: 4 }, streamForAxis('codestz', 2026, 'paletteDrift'));
    const before = palette();
    Array.from({ length: 9 }, streamForAxis('codestz', 2026, 'sigil')); // composer grows
    expect(palette()).toEqual(before);
  });

  it('spreads distinct logins across distinct seeds', () => {
    const logins = Array.from({ length: 2000 }, (_, i) => `dev-${i}`);
    const seeds = new Set(logins.map((l) => campaignSeed(l, 2026)));
    expect(seeds.size).toBe(logins.length);
  });
});

describe('scope — the crest is permanent, the season is not', () => {
  it('covers exactly the seeded axes', () => {
    expect(Object.keys(SEED_SCOPE).sort()).toEqual(seededAxes().sort());
  });

  it('keeps sigil and accessories identical across campaigns', () => {
    for (const axis of ['sigil', 'spriteAccessory'] as const) {
      const draw = (year: number) =>
        Array.from({ length: 5 }, streamForAxis('codestz', year, axis));
      expect(draw(2026)).toEqual(draw(2031));
    }
  });

  it('reshuffles palette and seal each campaign', () => {
    const draw = (year: number) =>
      Array.from({ length: 5 }, streamForAxis('codestz', year, 'paletteDrift'));
    expect(draw(2026)).not.toEqual(draw(2027));
    expect(seal(campaignSeed('codestz', 2026)))
      .not.toBe(seal(campaignSeed('codestz', 2027)));
  });

  it('still separates two users who share a campaign', () => {
    expect(identitySeed('codestz')).not.toBe(identitySeed('someoneelse'));
  });
});

describe('frozen tables', () => {
  const tinctures = frozenTable(1, 4, ['argent', 'azure', 'gules', 'sable'] as const);

  it('draws deterministically', () => {
    const draw = () => drawFrom(streamForAxis('codestz', 2026, 'sigil'), tinctures);
    expect(draw()).toBe(draw());
  });

  it('refuses a table whose length drifted from its declared size', () => {
    // Appending to a live sigil table silently redraws every existing crest.
    // Permanence makes that unacceptable, so it is a load-time error.
    expect(() => frozenTable(1, 4, ['argent', 'azure', 'gules'] as const))
      .toThrow(/Ship v2 instead/);
  });
});

describe('curation — all good, and still distinct', () => {
  // Trimming a table for taste is the right instinct and it silently raises
  // collisions. This is the number that must move visibly when it happens.
  const TARGET_USERS = 100_000;

  it('keeps the sigil space above the distinctness floor', () => {
    expect(sigilSpace()).toBeGreaterThanOrEqual(5_000_000);
  });

  it('declares only dimensions the composer actually builds', () => {
    // `chargeTincture` was declared here and never implemented, so the floor
    // test passed on 3x the distinctness anything rendered. Declared and actual
    // must agree or the guard guards nothing.
    expect(sigilCombinations()).toBe(sigilSpace());
  });

  it('keeps colliding users under 2% at target scale', () => {
    const pairs = expectedCollisions(TARGET_USERS, sigilSpace());
    expect((2 * pairs) / TARGET_USERS).toBeLessThan(0.02);
  });

  it('pays for curation with at least one non-clashing dimension', () => {
    // Curated-only collapses the space (~12% collide at 100k). The free
    // dimensions are what buy it back, so there must always be one.
    const free = SIGIL_DIMENSIONS.filter((d) => d.risk === 'free');
    expect(free.length).toBeGreaterThan(0);
    const freeSpace = free.reduce((n, d) => n * d.size, 1);
    expect(freeSpace).toBeGreaterThanOrEqual(24);
  });

  it('documents every dimension it multiplies', () => {
    for (const d of SIGIL_DIMENSIONS) {
      expect(d.size).toBeGreaterThan(1);
      expect(d.note.length).toBeGreaterThan(20);
    }
  });
});

describe('flourish — luck, never merit', () => {
  const N = 20_000;
  const seen: Record<string, number> = {};
  for (let i = 0; i < N; i++) {
    const f = drawFlourish(`dev-${i}`);
    seen[f] = (seen[f] ?? 0) + 1;
  }

  it('matches its declared weights', () => {
    const total = FLOURISHES.reduce((n, [, w]) => n + w, 0);
    for (const [name, w] of FLOURISHES) {
      expect((seen[name] ?? 0) / N, name).toBeCloseTo(w / total, 2);
    }
  });

  it('keeps shiny a genuine surprise', () => {
    expect((seen['shiny'] ?? 0) / N).toBeLessThan(0.02);
    expect(seen['shiny']).toBeGreaterThan(0);
  });

  it('is permanent, like the crest it decorates', () => {
    expect(drawFlourish('codestz')).toBe(drawFlourish('codestz'));
  });

  it('stays out of the distinctness space it does not uniformly multiply', () => {
    // A 1-in-200 outcome counted as "x4 distinctness" would overstate the space
    // the collision floor is asserted against.
    expect(SIGIL_DIMENSIONS.map((d) => d.name)).not.toContain('flourish');
  });
});
