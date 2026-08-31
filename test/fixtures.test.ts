/**
 * A fixture must actually have the shape its name claims.
 *
 * This is the test whose absence let `heavy-committer` and `heavy-reviewer`
 * both classify as `sentinel`. Every other suite uses the fixtures for layout,
 * budgets and byte-identity — none of which notices that the inputs stopped
 * meaning what they say — so the fixtures drifted into being five variations
 * on "busy at everything" while still being described as five distinct shapes.
 */

import { describe, expect, it } from 'vitest';
import { FIXTURES } from '../src/fixtures.js';
import { normalise } from '../src/normalise.js';
import { classify, classMargin, hasSignal, standing, type Metric } from '../src/derive.js';

const of = (login: string) => FIXTURES.find((f) => f.login === login)!;
const p = (login: string) => normalise(of(login).raw);

/** The metric a fixture is named for must be its highest percentile. */
const peak = (login: string): Metric => {
  const v = p(login);
  return (Object.keys(v) as Metric[]).reduce((a, b) => (v[b] > v[a] ? b : a));
};

describe('fixtures have the shape their names claim', () => {
  it('heavy-committer peaks on commits and reads as a commit class', () => {
    expect(peak('heavy-committer')).toBe('commits');
    expect(['berserker', 'warrior']).toContain(classify(p('heavy-committer'))[0]);
  });

  it('heavy-reviewer peaks on reviews and reads as a review class', () => {
    expect(peak('heavy-reviewer')).toBe('reviews');
    expect(['healer', 'druid']).toContain(classify(p('heavy-reviewer'))[0]);
  });

  it('the two busiest fixtures do not collide', () => {
    // The specific regression: opposite inputs, same class.
    expect(classify(p('heavy-committer'))[0]).not.toBe(classify(p('heavy-reviewer'))[0]);
  });

  it('every fixture that gets CLASSED wins by a real margin', () => {
    // A margin near zero means the class was decided by noise, and the
    // campaign-long freeze would lock that coin toss in for a year.
    //
    // Scoped to `classed` deliberately. `mostly-private` wins by 0.0014, which
    // would be alarming if the card ever showed it — it does not. A sealed
    // profile has its class withheld, and main.ts gates `freezable` on
    // `state === 'classed'`, so the noisy result is never displayed and never
    // written to the state file. The narrow margin is a consequence of having
    // almost no public signal, which is exactly what `sealed` means.
    for (const f of FIXTURES) {
      const v = normalise(f.raw);
      const total = f.weeks.reduce((a, b) => a + b, 0) + f.restricted;
      if (standing(v, { sealed: f.restricted, total }) !== 'classed') continue;
      expect(classMargin(v), f.login).toBeGreaterThan(0.02);
    }
  });

  it('zero-activity carries no signal and is not classified', () => {
    expect(hasSignal(p('zero-activity'))).toBe(false);
  });

  it('mostly-private is sealed, not unclassed', () => {
    const f = of('mostly-private');
    const total = f.weeks.reduce((a, b) => a + b, 0) + f.restricted;
    expect(standing(p('mostly-private'), { sealed: f.restricted, total })).toBe('sealed');
  });
});
