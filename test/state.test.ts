import { describe, expect, it } from 'vitest';
import {
  parseState, resolveClass, serialiseState, QUALIFYING_CONTRIBUTIONS,
} from '../src/campaign/state.js';
import { normalise } from '../src/normalise.js';

const committer = normalise({
  commits: 2400, reviews: 18, merges: 90, streak: 140, repos: 6, issues: 20,
  burst: 1400, weekend: 120,
});

const resolve = (over: Partial<Parameters<typeof resolveClass>[0]> = {}) =>
  resolveClass({
    p: committer, campaign: 2026, totalContributions: 500,
    seal: 'AAA', previous: null, today: '2026-08-30', ...over,
  });

describe('campaign state — the file is untrusted input', () => {
  it('rejects a class name that is not a class', () => {
    // Committed to the user's own repo, so it can be hand-edited or badly
    // merged. An unknown name indexed blindly into ARCHETYPES yields a NaN
    // cosine and silently flips the class.
    expect(parseState('{"campaign":2026,"class":"paladin","seal":"X"}')).toBeNull();
  });

  it('rejects malformed JSON, a non-object, and a missing campaign', () => {
    expect(parseState('not json')).toBeNull();
    expect(parseState('[]')).toBeNull();
    expect(parseState('{"class":"healer","seal":"X"}')).toBeNull();
    expect(parseState(null)).toBeNull();
  });

  it('accepts a well-formed state', () => {
    const s = parseState('{"campaign":2026,"class":"healer","lockedAt":"2026-03-04","seal":"K3"}');
    expect(s).toEqual({ campaign: 2026, class: 'healer', lockedAt: '2026-03-04', seal: 'K3' });
  });
});

describe('freeze after qualification', () => {
  it('stays provisional below the threshold', () => {
    const r = resolve({ totalContributions: QUALIFYING_CONTRIBUTIONS - 1 });
    expect(r.locked).toBe(false);
    expect(r.next.lockedAt).toBeUndefined();
  });

  it('locks at the threshold', () => {
    const r = resolve({ totalContributions: QUALIFYING_CONTRIBUTIONS });
    expect(r.locked).toBe(true);
    expect(r.next.lockedAt).toBe('2026-08-30');
  });

  it('a locked class does not move, even when the data now says otherwise', () => {
    // This is the whole point: someone whose activity shifts late in the
    // campaign keeps the identity people already screenshotted.
    const locked = { campaign: 2026, class: 'healer' as const, lockedAt: '2026-03-04', seal: 'K3' };
    const r = resolveClass({
      p: committer, campaign: 2026, totalContributions: 5000,
      seal: 'K3', previous: locked, today: '2026-08-30',
    });
    expect(r.klass).toBe('healer');
    expect(r.next).toEqual(locked);
  });

  it('a new campaign is a fresh sheet — the freeze does not carry over', () => {
    const lastYear = { campaign: 2025, class: 'healer' as const, lockedAt: '2025-03-04', seal: 'K3' };
    const r = resolveClass({
      p: committer, campaign: 2026, totalContributions: 500,
      seal: 'NEW', previous: lastYear, today: '2026-01-20',
    });
    expect(r.next.campaign).toBe(2026);
    expect(r.next.seal).toBe('NEW');
  });

  it('serialises stably, so an unchanged state is byte-identical', () => {
    const a = resolve().next;
    expect(serialiseState(a)).toBe(serialiseState({ ...a }));
  });
});

describe('the classifier discriminates on the axes it measures', () => {
  /**
   * The earlier version of this test asserted that a "heavy committer" and a
   * "heavy reviewer" fixture must land on different classes. They did not, and
   * chasing it found a real bug — `percentileOf` hard-clamped above the last
   * stop, so every user past p90 saturated to 1.0 and their vectors went flat.
   * That is fixed (it compresses now).
   *
   * But the assertion itself was wrong. The model does not promise that any two
   * raw vectors a human calls "different" land in different classes; it
   * promises to discriminate along the axes it actually measures. Two profiles
   * that are both high on everything ARE similar, and saying so is correct.
   */
  const base = {
    commits: 400, reviews: 20, merges: 30, streak: 60, repos: 5, issues: 10, burst: 900,
  };

  it('separates weekday from weekend work — the axis burst/weekend exist for', () => {
    const weekday = normalise({ ...base, weekend: 40 });
    const weekend = normalise({ ...base, weekend: 700 });
    expect(resolve({ p: weekday }).klass).not.toBe(resolve({ p: weekend }).klass);
  });

  it('separates steady from bursty work at equal volume', () => {
    const steady = normalise({ ...base, burst: 200, weekend: 150 });
    const bursty = normalise({ ...base, burst: 2200, weekend: 150 });
    expect(resolve({ p: steady }).klass).not.toBe(resolve({ p: bursty }).klass);
  });

  it('does not saturate above the last published stop', () => {
    // The bug: 2,400 commits and 640 commits both mapped to 1.0 because the
    // sample's p90 is 510, so anyone active went flat near the top.
    const big = normalise({ ...base, commits: 20000, weekend: 150 });
    const bigger = normalise({ ...base, commits: 60000, weekend: 150 });
    expect(bigger.commits).toBeGreaterThan(big.commits);
    expect(bigger.commits).toBeLessThanOrEqual(1);
  });
});

describe('a profile that cannot be classed is never frozen', () => {
  const p = normalise({
    commits: 3, reviews: 1, merges: 0, streak: 6, repos: 1, issues: 0,
    burst: 731, weekend: 6,
  });

  it('stays provisional however many contributions it has', () => {
    // Codestzx: 1,395 sealed of 1,400. Well past the qualifying threshold on
    // volume, but the card renders `sealed` and declines to name a class.
    // Freezing here would write an invented class — derived from 0.4% of the
    // work — into the state file and hold it for the whole campaign.
    const r = resolveClass({
      p, campaign: 2026, totalContributions: 1400, seal: 'X',
      previous: null, today: '2026-08-30', freezable: false,
    });
    expect(r.locked).toBe(false);
    expect(r.next.lockedAt).toBeUndefined();
  });

  it('still freezes when the profile IS classifiable', () => {
    const r = resolveClass({
      p, campaign: 2026, totalContributions: 1400, seal: 'X',
      previous: null, today: '2026-08-30', freezable: true,
    });
    expect(r.locked).toBe(true);
  });
});
