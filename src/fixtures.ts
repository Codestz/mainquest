/**
 * The fixture set docs/01 requires for snapshot tests. The preview renders the
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

export const FIXTURES: Fixture[] = [
  {
    login: 'heavy-committer', note: 'commit volume dominates',
    raw: { commits: 2400, reviews: 18, merges: 90, streak: 140, repos: 6, issues: 20, burst: 1400, weekend: 120 },
    accountAgeYears: 6, prsOpened: 120, weeks: wave(0, 70), restricted: 0,
  },
  {
    login: 'heavy-reviewer', note: 'reviews and issues outweigh commits',
    raw: { commits: 210, reviews: 640, merges: 70, streak: 40, repos: 14, issues: 190, burst: 700,  weekend: 180 },
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
