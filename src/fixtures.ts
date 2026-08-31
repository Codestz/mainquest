/**
 * The fixture set the snapshot tests require. The preview renders the
 * same five, because the cases that break layout are the ones nobody looks at:
 * the empty account and the mostly-private one.
 */
import type { RawMetrics } from './normalise.js';

export interface Fixture {
  login: string;
  raw: RawMetrics;
  accountAgeYears: number;
  prsOpened: number;
  /** 52 weekly totals -> terrain and the generated horizon. */
  weeks: number[];
  restricted: number;
  note: string;
}

const wave = (seed: number, peak: number, spread = 1): number[] =>
  Array.from({ length: 52 }, (_, i) => {
    const s = Math.sin((i + seed) / 3.1) + Math.sin((i + seed) / 7.7) * 1.4;
    return Math.max(0, Math.round(((s + 2) / 4) ** 2 * peak * spread));
  });

/**
 * Raw values are chosen so the fixture's PERCENTILE peak matches its name.
 *
 * That is not automatic, and getting it wrong is invisible. The first version
 * of these two used raw numbers extreme on every axis at once — 2,400 commits
 * but also a 140-day streak, 20 issues and 6 repos. Against an n=165
 * distribution that lands p80+ on everything, nothing dominates, and both
 * `heavy-committer` and `heavy-reviewer` classified as `sentinel`: the two most
 * opposite fixtures in the set, same class.
 *
 * Nothing caught it, because no test asserted a fixture's class — the one in
 * `test/toolchain.test.ts` used a hand-written vector that happened to share a
 * name. `test/fixtures.test.ts` now ties each fixture to the shape it claims.
 */
export const FIXTURES: Fixture[] = [
  {
    login: 'heavy-committer', note: 'commit volume dominates, in bursts',
    raw: { commits: 4200, reviews: 0, merges: 2, streak: 9, repos: 2, issues: 0, burst: 2100, weekend: 120 },
    accountAgeYears: 6, prsOpened: 120, weeks: wave(0, 70), restricted: 0,
  },
  {
    login: 'heavy-reviewer', note: 'reviews and issues outweigh commits',
    raw: { commits: 40, reviews: 1200, merges: 12, streak: 7, repos: 2, issues: 18, burst: 850, weekend: 60 },
    accountAgeYears: 9, prsOpened: 55, weeks: wave(11, 34), restricted: 0,
  },
  {
    login: 'brand-new', note: 'account created this campaign',
    raw: { commits: 34, reviews: 0, merges: 2, streak: 6, repos: 2, issues: 1, burst: 1900, weekend: 520 },
    accountAgeYears: 0.3, prsOpened: 4, weeks: wave(4, 6, 0.4).map((n, i) => (i < 40 ? 0 : n)),
    restricted: 0,
  },
  {
    login: 'mostly-private', note: 'corporate dev, public profile looks empty',
    raw: { commits: 40, reviews: 12, merges: 5, streak: 9, repos: 3, issues: 4, burst: 800,  weekend: 140 },
    accountAgeYears: 7, prsOpened: 9, weeks: wave(21, 5, 0.5), restricted: 1840,
  },
  {
    login: 'zero-activity', note: 'the empty state everyone forgets',
    raw: { commits: 0, reviews: 0, merges: 0, streak: 0, repos: 0, issues: 0, burst: 0,    weekend: 0 },
    accountAgeYears: 2, prsOpened: 0, weeks: Array(52).fill(0), restricted: 0,
  },
];

/**
 * A fixture, shaped exactly like a fetched profile.
 *
 * This is what lets CI run the REAL action — the committed `dist-action`
 * bundle, reading real `INPUT_*` variables, writing real files — with no token
 * and no network. Before this existed, CI could prove the bundle was in
 * lockstep with `src/` and could not prove it started.
 *
 * `campaignDay` is pinned rather than derived from the clock: a fixture render
 * has to be byte-identical on any day, or the end-to-end test fails every
 * midnight for reasons that have nothing to do with the change under test.
 */
export const FIXTURE_DAY = 242;

export function fixtureProfile(login: string, campaign: number): {
  login: string; campaign: number; raw: RawMetrics; weeks: number[];
  restricted: number; accountAgeYears: number; prsOpened: number;
  campaignDay: number; mergesAreReal: boolean; calendarTotal: number;
} {
  const f = FIXTURES.find((x) => x.login === login);
  if (!f) {
    throw new Error(
      `No such fixture: "${login}". Available: ${FIXTURES.map((x) => x.login).join(', ')}`,
    );
  }
  return {
    login: f.login,
    campaign,
    raw: f.raw,
    weeks: f.weeks,
    restricted: f.restricted,
    accountAgeYears: f.accountAgeYears,
    prsOpened: f.prsOpened,
    campaignDay: FIXTURE_DAY,
    mergesAreReal: true,
    calendarTotal: f.weeks.reduce((a, b) => a + b, 0) + f.restricted,
  };
}
