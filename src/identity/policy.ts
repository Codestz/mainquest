/**
 * Axis ownership and scope — the load-bearing decision of the identity layer.
 *
 * `Axis` derives from the AXES array, so Record<Axis, Source> fails to COMPILE
 * when an axis is added without an owner. There is no runtime default: a new
 * axis cannot silently land in ornament.
 */
import { campaignSeed, identitySeed, laneFor, prng } from './seed.js';

// ---------------------------------------------------------------------------
// The axes
// ---------------------------------------------------------------------------

/**
 * Every visual axis on the card. This array is the single source of truth:
 * `Axis` is derived from it, so `Record<Axis, Source>` below fails to compile
 * the moment a new axis is added without an owner. No runtime default, ever.
 */
export const AXES = [
  // ornament candidates
  'sigil',            // heraldic crest: shield x charge x ordinary x tinctures
  'paletteDrift',     // hue-rotate on the world, +/-18deg
  'spriteAccessory',  // helm | cloak | weapon | familiar slots
  'seal',             // the 6-char mark
  'starScatter',      // decorative background stars
  // measurement candidates
  'spriteBase',       // which of the 6 class sprites
  'horizon',          // mountain silhouette from 12 monthly totals
  'constellation',    // stars placed at your peak weeks
  'weather',          // last-30d trend vs campaign baseline
  'terrain',          // the contribution grid itself
  'skyBand',          // campaign progress: Jan dawn -> Dec night
  'statBars',         // cmt / rev fill
  'abilityTiers',     // I / II / III pips
  'windowChrome',     // must stay identical across ALL users (docs/04)
] as const;

export type Axis = (typeof AXES)[number];

/**
 * 'seed'  -> varies per login. Ornament. Means nothing, and must never be
 *            placed where it could be read as a measurement.
 * 'data'  -> derived from this user's contribution metrics. Carries meaning.
 * 'fixed' -> the same for every user at a given moment. Note this is not the
 *            same as constant: it may move with the world (the campaign clock),
 *            just never with *you*. This is what makes the set read as one game.
 */
export type Source = 'seed' | 'data' | 'fixed';

/** Axes that render adjacent to a `mide:` line. VISION: these are data, period. */
export const MEASURED_ADJACENT = ['statBars', 'abilityTiers'] as const;

/**
 * Who owns each axis.
 *
 * Trade-off this resolves:
 *   more 'seed'  -> every card unique, but viewers can't separate ornament
 *                   from measurement, and the card becomes decoration
 *   more 'data'  -> readouts stay trustworthy, but cards visually collide
 *
 * The split taken here: seed owns things a viewer reads as *heraldry*, data
 * owns things a viewer reads as a *chart*. Nobody has to be told which is
 * which, because the two never share a visual language.
 *
 * Asserted exhaustively in test/identity.test.ts.
 */
export function seedPolicy(): Record<Axis, Source> {
  return {
    // -- ornament: yours, meaningless, and unmistakably decorative ----------
    sigil: 'seed',
    paletteDrift: 'seed',
    spriteAccessory: 'seed',
    seal: 'seed',

    // Decorative stars are 'fixed', not 'seed'. Two star systems on one canvas
    // is the ambiguity that breaks the whole rule: if background scatter varied
    // per login, no viewer could tell which stars are the constellation that
    // actually means something. Freeze the scatter; let only meaning move.
    starScatter: 'fixed',

    // -- measurement: this user's year -------------------------------------
    spriteBase: 'data',      // class, from the cosine classification
    horizon: 'data',         // 12 monthly totals -> mountain silhouette
    constellation: 'data',   // peak weeks -> the only stars that move
    weather: 'data',         // last 30d vs campaign baseline
    terrain: 'data',         // the contribution grid
    statBars: 'data',
    abilityTiers: 'data',

    // -- the shared world ---------------------------------------------------
    // Day-of-campaign is the calendar, not you: every card rendered on the same
    // day gets the same sky. Marking it 'data' would imply the sky measures
    // something about the user. It doesn't -- it measures the campaign, and the
    // campaign is everyone's. Two people comparing cards in March see the same
    // dawn, which is exactly what makes them feel like one game.
    skyBand: 'fixed',

    windowChrome: 'fixed',
  };
}

/** Convenience for the renderer: the axes it may drive from the PRNG. */
export const seededAxes = (): Axis[] =>
  AXES.filter((a) => seedPolicy()[a] === 'seed');

// ---------------------------------------------------------------------------
// Scope: which seeded axes are permanent, which reshuffle each campaign
// ---------------------------------------------------------------------------

export type Scope = 'identity' | 'campaign';

/**
 * Heraldry is family identity -- it is supposed to persist. A crest that
 * changes every January is a yearly skin, not yours, which defeats the whole
 * point of the identity layer. So the sigil and the accessories that hang off
 * the character are drawn from `identitySeed(login)` and never move.
 *
 * Palette and seal are campaign-scoped on purpose: a new campaign should read
 * as a new chapter, and the seal is this year's save marker. The 2026 and 2027
 * cards are the same character in different seasons.
 *
 * Consequence, and it is the price of permanence: the tables behind an
 * 'identity' axis can never be edited. See FrozenTable above.
 */
export const SEED_SCOPE = {
  sigil: 'identity',
  spriteAccessory: 'identity',
  paletteDrift: 'campaign',
  seal: 'campaign',
} as const satisfies Record<string, Scope>;

export type SeededAxis = keyof typeof SEED_SCOPE;

/**
 * The renderer's entry point. Routes an axis to the right root seed, so no
 * call site has to remember whether a crest is permanent.
 */
export function streamForAxis(
  login: string,
  campaign: number,
  axis: SeededAxis,
): () => number {
  const root = SEED_SCOPE[axis] === 'identity'
    ? identitySeed(login)
    : campaignSeed(login, campaign);
  return prng(laneFor(root, axis));
}
