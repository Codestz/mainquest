/**
 * Everything derived about a profile, computed ONCE.
 *
 * There are now two cards. If each ran its own `classify()`, `standing()` and
 * `rank()`, nothing would stop them disagreeing — and a status card reading
 * "Hermit" beside an ability card reading "Sentinel" is the single worst bug
 * this project could ship, because both would look completely fine on their
 * own. The derivation lives here; the cards only lay it out.
 *
 * This file makes no rendering decisions and imports no theme.
 */

import type { Locale } from '../i18n/locales.js';
import {
  classify, classMargin, debuffs, rank, standing,
  type ClassName, type Metric, type Standing,
} from '../derive.js';
import { campaignSeed, pick, seal, streamForAxis } from '../identity/index.js';
import { composeSigil } from './sigil/index.js';
import { FAMILIARS } from './scene/sprite.js';
import type { CardInput } from './card.js';

/** The ability each metric surfaces as. */
export const ABILITY_OF: Record<Metric, keyof Locale['abilities']> = {
  commits: 'sustained_strike', reviews: 'second_opinion', merges: 'close_the_loop',
  streak: 'endurance', repos: 'open_fronts', issues: 'tracking',
  burst: 'burstfire', weekend: 'sabbath',
};

/** The six that the status card can rank. `burst`/`weekend` describe shape. */
export const COUNTED: readonly Metric[] =
  ['commits', 'reviews', 'merges', 'streak', 'repos', 'issues'];

export type Tier = 0 | 1 | 2 | 3;

/**
 * Tier from percentile — but never above zero for a count of zero.
 *
 * `tier(0)` used to be 1, so a profile with no reviews at all still lit one
 * pip beside "second opinion" and printed "tier 1 of 3". An ability you have
 * literally never used is not tier 1; it is untrained. The empty card was
 * making the one kind of claim this project exists not to make, and it took
 * the ability sheet — eight rows of it at once — to make that obvious.
 *
 * The floor is keyed to the RAW count, not the percentile: a percentile can
 * round to zero for someone who is genuinely at the bottom of the sample but
 * has still done the thing, and that is a tier 1.
 */
export const tierOf = (percentile: number, raw: number): Tier =>
  raw === 0 ? 0 : percentile >= 0.85 ? 3 : percentile >= 0.5 ? 2 : 1;

/**
 * How a metric's raw number should be read aloud.
 *
 * Six of the eight are counts and print as themselves. The other two are not:
 * `burst` is a coefficient of variation scaled by 1000 and `weekend` is a
 * per-mille share (see metrics/calendar.ts). Printing "1022 this campaign" for
 * a burst of 1.02 would be worse than printing nothing — it looks like a
 * number the reader can compare against their commit count, and it is not.
 */
const READOUT: Partial<Record<Metric, (raw: number) => string>> = {
  burst: (n) => `${(n / 1000).toFixed(2)}×`,
  weekend: (n) => `${Math.round(n / 10)}%`,
};

export interface AbilityRow {
  metric: Metric;
  /** Key into `locales/*.json` -> abilities. */
  key: keyof Locale['abilities'];
  /** Percentile in the sample, 0..1. */
  p: number;
  tier: Tier;
  /** The raw number, formatted for its unit. */
  readout: string;
}

export interface Sheet {
  klass: ClassName;
  sub: ClassName;
  state: Standing;
  /** Whether the card is entitled to name a class at all. */
  classified: boolean;
  margin: number;
  rank: string;
  debuffs: string[];
  sigil: ReturnType<typeof composeSigil>;
  seal: string;
  familiar: string;
  /** Per-campaign hue shift for the WORLD only, never the chrome. */
  drift: number;
  /** All eight, strongest first. */
  abilities: AbilityRow[];
}

export function characterSheet(i: CardInput): Sheet {
  const [klass, sub] = classify(i.p);
  const state = standing(i.p, { sealed: i.restricted, total: i.calendarTotal });

  const abilities = (Object.keys(ABILITY_OF) as Metric[])
    .map((m): AbilityRow => ({
      metric: m,
      key: ABILITY_OF[m],
      p: i.p[m],
      tier: tierOf(i.p[m], i.raw[m] ?? 0),
      readout: (READOUT[m] ?? String)(i.raw[m] ?? 0),
    }))
    // Strongest first. The status card takes the head of this list; the
    // ability card prints all of it.
    .sort((a, b) => b.p - a.p);

  return {
    klass, sub, state,
    classified: state === 'classed',
    margin: classMargin(i.p),
    rank: rank(i.raw['reviews'] ?? 0, i.prsOpened, i.accountAgeYears),
    debuffs: debuffs(i.p),
    sigil: composeSigil(i.login, i.campaign, 40),
    seal: seal(campaignSeed(i.login, i.campaign)),
    familiar: pick(streamForAxis(i.login, i.campaign, 'spriteAccessory'), FAMILIARS),
    drift: Math.round((streamForAxis(i.login, i.campaign, 'paletteDrift')() - 0.5) * 36),
    abilities,
  };
}
