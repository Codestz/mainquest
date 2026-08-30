/**
 * The pure core. No I/O in this file, ever.
 * This is the function that later feeds a video renderer or a duel sim.
 */

export type Metric =
  | 'commits' | 'reviews' | 'merges'
  | 'streak' | 'repos' | 'issues';

export type Percentiles = Record<Metric, number>; // 0..1

export type ClassName =
  | 'warrior' | 'mage' | 'healer'
  | 'rogue' | 'guardian' | 'necromancer';

// Hand-authored archetype vectors in the same 6-d space.
// Adding a class = one entry here. No threshold chains.
const ARCHETYPES: Record<ClassName, Percentiles> = {
  warrior:     { commits: 1.0, reviews: 0.2, merges: 0.5, streak: 0.6, repos: 0.4, issues: 0.3 },
  mage:        { commits: 0.5, reviews: 0.3, merges: 0.4, streak: 0.3, repos: 1.0, issues: 0.5 },
  healer:      { commits: 0.3, reviews: 1.0, merges: 0.5, streak: 0.5, repos: 0.5, issues: 0.8 },
  rogue:       { commits: 0.4, reviews: 0.4, merges: 0.9, streak: 0.2, repos: 0.9, issues: 0.4 },
  guardian:    { commits: 0.8, reviews: 0.7, merges: 0.6, streak: 1.0, repos: 0.1, issues: 0.5 },
  necromancer: { commits: 0.6, reviews: 0.3, merges: 0.5, streak: 0.2, repos: 0.6, issues: 0.7 },
};

const KEYS: readonly Metric[] = [
  'commits', 'reviews', 'merges', 'streak', 'repos', 'issues',
];

const CLASSES = Object.keys(ARCHETYPES) as ClassName[];

export const isClassName = (v: unknown): v is ClassName =>
  typeof v === 'string' && (CLASSES as string[]).includes(v);

function cosine(a: Percentiles, b: Percentiles): number {
  let dot = 0, na = 0, nb = 0;
  for (const k of KEYS) { dot += a[k] * b[k]; na += a[k] ** 2; nb += b[k] ** 2; }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) || 1);
}

/** Returns [best, runnerUp]. runnerUp is the subclass — free, and it makes
 *  "guerrero, senda del guardián" possible. */
export function classify(p: Percentiles): [ClassName, ClassName] {
  const scored = CLASSES
    .map((name) => [name, cosine(p, ARCHETYPES[name])] as const)
    .sort((x, y) => y[1] - x[1]);
  // Six archetypes are hard-coded, so both slots always exist.
  return [scored[0]![0], scored[1]![0]];
}

/** Hysteresis. Without this the class flips week to week and the identity is
 *  worthless. Mechanism decided in docs/07#2: provisional under 100 campaign
 *  contributions, frozen above it, and this margin check runs only at campaign
 *  rollover. The caller owns the phase; this function owns the margin. */
export function classifyStable(
  p: Percentiles,
  previous: string | null,
  margin = 0.15,
): [ClassName, ClassName] {
  const [best, runnerUp] = classify(p);
  // `previous` comes off disk (the campaign state file), so it may be stale
  // or garbage. An unknown name must fall through to the fresh result --
  // indexing it blind yields NaN and silently flips the class.
  if (!isClassName(previous) || previous === best) return [best, runnerUp];
  const scoreBest = cosine(p, ARCHETYPES[best]);
  const scorePrev = cosine(p, ARCHETYPES[previous]);
  return scoreBest - scorePrev > margin ? [best, runnerUp] : [previous, best];
}

/** Seniority. No numbers anywhere — this returns a rank slug.
 *  Primary signal: reviews given vs PRs opened. Both are free in the Tier 0
 *  query, unlike reviews *received* which needs per-PR pagination. */
export function rank(
  reviewsGiven: number,
  pullRequestsOpened: number,
  accountAgeYears: number,
): string {
  const ratio = reviewsGiven / Math.max(pullRequestsOpened, 1);
  const score = Math.log1p(ratio) * 2 + Math.min(accountAgeYears, 10) / 10;
  if (score < 0.6) return 'apprentice';
  if (score < 1.2) return 'journeyman';
  if (score < 1.9) return 'veteran';
  if (score < 2.6) return 'master';
  return 'archon';
}

/** The honest half of the sheet. */
export function debuffs(p: Percentiles): string[] {
  const out: string[] = [];
  if (p.commits > 0.7 && p.reviews < 0.15) out.push('lone_wolf');
  if (p.merges < 0.3 && p.commits > 0.5)   out.push('revolving_door');
  if (p.repos < 0.1  && p.commits > 0.6)   out.push('ivory_tower');
  return out;
}
