/**
 * The pure core. No I/O in this file, ever.
 * This is the function that later feeds a video renderer or a duel sim.
 */

export type Metric =
  // volume and breadth
  | 'commits' | 'reviews' | 'merges' | 'streak' | 'repos' | 'issues'
  // SHAPE, not volume: free from the daily calendar we already fetch, and the
  // only metrics here you cannot move by committing *more* — only differently.
  // Six volume-ish dimensions could not separate 12 archetypes; these two can.
  | 'burst' | 'weekend';

export type Percentiles = Record<Metric, number>; // 0..1

/**
 * Twelve classes, two per anchoring metric. Each pair shares a dominant metric
 * and is split by a SHAPE axis, which is what makes them separable:
 *
 *   commits  berserker (spiky)      / warrior  (metronomic)
 *   reviews  healer    (weekday)    / druid    (weekends)
 *   merges   finisher  (steady)     / rogue    (opportunistic, others' repos)
 *   streak   sentinel  (weekday)    / hermit   (weekends)
 *   repos    mage      (sustained)  / wanderer (drive-by)
 *   issues   tracker   (steady)     / necromancer (bursty)
 */
export type ClassName =
  | 'berserker' | 'warrior'
  | 'healer' | 'druid'
  | 'finisher' | 'rogue'
  | 'sentinel' | 'hermit'
  | 'mage' | 'wanderer'
  | 'tracker' | 'necromancer';

// Hand-authored archetype vectors in the same 6-d space.
// Adding a class = one entry here. No threshold chains.
const ARCHETYPES: Record<ClassName, Percentiles> = {
  //             commits reviews merges streak repos issues burst weekend
  berserker:   { commits: 1.0, reviews: 0.1, merges: 0.3, streak: 0.2, repos: 0.2, issues: 0.2, burst: 1.0, weekend: 0.4 },
  warrior:     { commits: 1.0, reviews: 0.3, merges: 0.6, streak: 0.9, repos: 0.4, issues: 0.3, burst: 0.2, weekend: 0.3 },
  healer:      { commits: 0.3, reviews: 1.0, merges: 0.4, streak: 0.5, repos: 0.4, issues: 0.4, burst: 0.4, weekend: 0.3 },
  druid:       { commits: 0.3, reviews: 1.0, merges: 0.4, streak: 0.5, repos: 0.4, issues: 0.4, burst: 0.4, weekend: 1.0 },
  finisher:    { commits: 0.4, reviews: 0.3, merges: 1.0, streak: 0.5, repos: 0.3, issues: 0.2, burst: 0.2, weekend: 0.3 },
  rogue:       { commits: 0.4, reviews: 0.4, merges: 1.0, streak: 0.2, repos: 0.9, issues: 0.3, burst: 0.9, weekend: 0.5 },
  sentinel:    { commits: 0.6, reviews: 0.5, merges: 0.4, streak: 1.0, repos: 0.2, issues: 0.3, burst: 0.2, weekend: 0.2 },
  hermit:      { commits: 0.6, reviews: 0.2, merges: 0.3, streak: 1.0, repos: 0.1, issues: 0.2, burst: 0.3, weekend: 1.0 },
  mage:        { commits: 0.5, reviews: 0.3, merges: 0.4, streak: 0.4, repos: 1.0, issues: 0.5, burst: 0.3, weekend: 0.3 },
  wanderer:    { commits: 0.3, reviews: 0.2, merges: 0.3, streak: 0.2, repos: 1.0, issues: 0.3, burst: 1.0, weekend: 0.5 },
  tracker:     { commits: 0.3, reviews: 0.4, merges: 0.2, streak: 0.4, repos: 0.4, issues: 1.0, burst: 0.3, weekend: 0.3 },
  necromancer: { commits: 0.5, reviews: 0.2, merges: 0.3, streak: 0.2, repos: 0.5, issues: 1.0, burst: 0.9, weekend: 0.6 },
};

const KEYS: readonly Metric[] = [
  'commits', 'reviews', 'merges', 'streak', 'repos', 'issues', 'burst', 'weekend',
];

const CLASSES = Object.keys(ARCHETYPES) as ClassName[];

export const isClassName = (v: unknown): v is ClassName =>
  typeof v === 'string' && (CLASSES as string[]).includes(v);

function cosine(a: Percentiles, b: Percentiles): number {
  // CENTRED cosine (i.e. correlation), not raw cosine.
  //
  // Every percentile vector lives in the positive orthant, so raw cosine is
  // inflated by a shared baseline that all users hold in common: the angle
  // between "slightly above average at everything" and "slightly below average
  // at everything" is tiny, even though they are opposite people.
  //
  // Measured over 165 real users across 12 archetypes:
  //
  //                        raw      centred
  //   closest pair        0.945      0.786
  //   win margin median   0.029      0.091
  //   win margin p10      0.005      0.015
  //
  // The p10 number is the one that matters: at 0.005 the bottom decile's class
  // was decided by noise a single commit would flip, which would have made the
  // campaign-long class freeze (docs/07#2) freeze a coin toss.
  const ma = KEYS.reduce((s, k) => s + a[k], 0) / KEYS.length;
  const mb = KEYS.reduce((s, k) => s + b[k], 0) / KEYS.length;
  let dot = 0, na = 0, nb = 0;
  for (const k of KEYS) {
    const x = a[k] - ma, y = b[k] - mb;
    dot += x * y; na += x * x; nb += y * y;
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) || 1);
}

/** Returns [best, runnerUp]. runnerUp is the subclass — free, and it makes
 *  "guerrero, senda del guardián" possible. */
export function classify(p: Percentiles): [ClassName, ClassName] {
  const scored = CLASSES
    .map((name) => [name, cosine(p, ARCHETYPES[name])] as const)
    .sort((x, y) => y[1] - x[1]);
  // Twelve archetypes are hard-coded, so both slots always exist.
  return [scored[0]![0], scored[1]![0]];
}

/**
 * Whether the vector carries enough signal to be classified at all.
 *
 * Centred cosine measures the SHAPE of a vector, so a flat one — all zeros, or
 * all the same value — has no shape to measure: every archetype scores 0/0 and
 * the sort silently returns whichever class happens to be first in the list.
 * That labelled the empty-account fixture `berserker`, the extreme
 * high-volume class, which is the exact opposite of what it is.
 *
 * The empty state is the one docs/01 says everyone forgets. It is not a class
 * and the card must not invent one for it.
 */
export function hasSignal(p: Percentiles): boolean {
  const mean = KEYS.reduce((s, k) => s + p[k], 0) / KEYS.length;
  const variance = KEYS.reduce((s, k) => s + (p[k] - mean) ** 2, 0) / KEYS.length;
  return Math.sqrt(variance) > 0.01;
}

/** How the card should describe someone, given what it can actually see. */
export type Standing =
  /** Enough public, typed activity to name a class. */
  | 'classed'
  /** Most work is private. The rhythm is known; the role is not. */
  | 'sealed'
  /** Nothing to go on yet. */
  | 'unclassed';

export interface Visibility {
  /** `restrictedContributionsCount` — private work, count only, no type. */
  sealed: number;
  /** Contribution-calendar total. INCLUDES the sealed days. */
  total: number;
}

/**
 * What the card is entitled to claim.
 *
 * `restrictedContributionsCount` is a bare number: docs/02 notes it tells you
 * how many private contributions there were but not what type. So for someone
 * whose work is mostly behind SSO, every TYPED metric — commits, reviews,
 * merges, repos, issues — describes only the sliver that happens to be public,
 * and classifying on it is classifying on noise.
 *
 * A real case: 1,395 sealed against 3 commits and 1 review. The card called
 * that account `healer`, on the strength of one review — 0.3% of the work it
 * actually did. `docs/02` predicted exactly this ("the card can come out nearly
 * empty and they'll assume it's broken"); it is worse than empty, because it is
 * confidently wrong.
 *
 * The rhythm survives, though. The contribution CALENDAR counts private days,
 * so streak, burst, weekend and the terrain are all true. Hence a third
 * standing rather than a binary: we know when they work, not what they did.
 */
export function standing(p: Percentiles, v: Visibility): Standing {
  if (v.total <= 0) return 'unclassed';
  const publicShare = (v.total - v.sealed) / v.total;
  // Below this, the typed metrics describe too little of the person to name.
  if (publicShare < 0.35) return 'sealed';
  return hasSignal(p) ? 'classed' : 'unclassed';
}

/**
 * The margin by which the winning class beat the runner-up.
 *
 * A large margin means a textbook example of the archetype; a small one means a
 * hybrid who belongs to no class cleanly. NEITHER IS BETTER — this is shape,
 * not merit, and it is not farmable by committing more because it is entirely
 * ratios. Kept separate from `flourish`, which is luck: if one number could
 * mean either "you got lucky" or "you're good", the card stops being readable.
 */
export function classMargin(p: Percentiles): number {
  const scored = CLASSES
    .map((name) => cosine(p, ARCHETYPES[name]))
    .sort((a, b) => b - a);
  return (scored[0] ?? 0) - (scored[1] ?? 0);
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
