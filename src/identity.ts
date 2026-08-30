/**
 * Visual identity layer. Pure — no I/O, same contract as derive.example.ts.
 *
 * Problem this solves: class+rank+debuff yields ~90 visual outcomes. At any
 * real user count, cards collide. This file adds a SECOND axis (deterministic
 * seed from the login) so no two cards look alike.
 *
 * The rule that keeps it honest:
 *   data  -> anything a viewer could read as a MEASUREMENT
 *   seed  -> ornament only, never claims to measure anything
 * See seedPolicy() below — that boundary is the design decision.
 */

// ---------------------------------------------------------------------------
// Seed
// ---------------------------------------------------------------------------
//
// What this does and does not give you:
//
//   deterministic  -- guaranteed. Same login + campaign -> same card, forever.
//   distinct       -- probabilistic. 64-bit keeps collisions negligible at any
//                     plausible user count (32-bit did not: ~69% chance of a
//                     collided pair at 100k users).
//   unforgeable    -- NO. The input is a public login, so anyone can compute
//                     anyone's seed and render their card. `seal` proves the
//                     card was *derived* from that login; it proves nothing
//                     about who rendered it. Ownership needs a registry, not a
//                     hash. Do not describe this as minted, owned, or signed.

const FNV64_OFFSET = 0xcbf29ce484222325n;
const FNV64_PRIME = 0x100000001b3n;
const MASK64 = 0xffffffffffffffffn;

function fnv1a64(input: string, init = FNV64_OFFSET): bigint {
  let h = init;
  for (let i = 0; i < input.length; i++) {
    h ^= BigInt(input.charCodeAt(i));
    h = (h * FNV64_PRIME) & MASK64;
  }
  return h;
}

/**
 * The permanent root. Campaign-invariant, so anything drawn from it is yours
 * for as long as the login exists.
 */
export function identitySeed(login: string): bigint {
  return fnv1a64(login.toLowerCase());
}

/** The per-campaign root. Reshuffles every January. */
export function campaignSeed(login: string, campaign: number): bigint {
  return fnv1a64(`${login.toLowerCase()}#${campaign}`);
}

/**
 * A 32-bit lane for one axis, derived from a root seed and the axis name.
 *
 * Why per-axis lanes instead of one shared stream: with a single PRNG, the
 * order of draws is part of the contract. Add one `pick()` to the sigil
 * composer and every draw after it shifts -- so a version bump silently
 * repaints every existing user's palette and accessories. Cards are screenshot
 * and shared; they must not mutate because you shipped a new shield shape.
 * Independent lanes make each axis's stream immune to changes in the others.
 */
export function laneFor(seed: bigint, axis: string): number {
  const h = fnv1a64(axis, seed ^ 0x9e3779b97f4a7c15n);
  return Number((h ^ (h >> 32n)) & 0xffffffffn) >>> 0;
}

/** mulberry32. Same lane -> same stream, forever. */
export function prng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Save-file style mark, rendered bottom-right. Eight base36 characters, so the
 * displayed mark does not become the narrow point -- a 6-char seal is ~2^31 of
 * space and would reintroduce the collision the 64-bit seed just removed.
 *
 * Campaign-scoped: the seal identifies this year's save, not the character.
 * Recomputable by anyone from the login. A checksum, not a signature.
 */
export function seal(seed: bigint): string {
  return (seed & MASK64).toString(36).toUpperCase().padStart(8, '0').slice(-8);
}

// ---------------------------------------------------------------------------
// Frozen tables
// ---------------------------------------------------------------------------
//
// A permanent sigil forces a constraint that is easy to miss: `pick()` selects
// with `floor(rnd() * items.length)`, so **changing a table's length reshuffles
// every existing user**. Appending one charge to a 4,000-entry list is not an
// additive change -- it silently redraws everyone's crest.
//
// So sigil tables are frozen. The declared size is part of the table, a
// mismatch throws at load, and the version is pinned per user in
// `dist/questlog.state.json`. Growing the catalogue means shipping v2 and
// leaving existing users on v1 -- never editing v1 in place.

export interface FrozenTable<T> {
  readonly version: number;
  readonly size: number;
  readonly items: readonly [T, ...T[]];
}

export function frozenTable<T>(
  version: number,
  size: number,
  items: readonly [T, ...T[]],
): FrozenTable<T> {
  if (items.length !== size) {
    throw new Error(
      `frozen table v${version}: declared ${size} entries, got ${items.length}. ` +
      `Editing a frozen table redraws every existing user's sigil. Ship v${version + 1} instead.`,
    );
  }
  return { version, size, items };
}

export function pick<T>(rnd: () => number, xs: readonly [T, ...T[]]): T {
  // Non-empty tuple type: an empty table is a build error, not a runtime
  // `undefined` that reaches the renderer as a blank sigil.
  return xs[Math.floor(rnd() * xs.length)] as T;
}

export const drawFrom = <T>(rnd: () => number, t: FrozenTable<T>): T =>
  pick(rnd, t.items);

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

// ---------------------------------------------------------------------------
// Curation
// ---------------------------------------------------------------------------
//
// A uniqueness machine drawing from bad tables makes unique bad cards, and that
// reads *cheaper* than one hand-made crest everyone shares. So the tables are
// curated. The trap is that curating naively costs a lot of distinctness:
//
//   uncurated (4,000 icons, free multiply)  23,040,000  -> 0.43% of users
//                                                          collide at 100k
//   curated, single charge                     829,440  -> 12.06% at 100k
//   curated + a dimension that CANNOT clash  9,953,280  ->  1.01% at 100k
//
// So the rule is not "fewer combinations". It is:
//
//   CURATE the dimensions that can visually clash.
//   MULTIPLY freely on the dimensions that geometrically cannot.
//
// A second charge overlapping the first is ugly. A cadency mark in a fixed
// corner, at a fixed size, over a field whose contrast was already checked,
// cannot be. That dimension is free distinctness, and it is what pays for the
// curation everywhere else.

export type ClashRisk =
  /** Hand-reviewed list. Every entry checked at render size, in both themes. */
  | 'curated'
  /** Geometrically incapable of clashing: fixed slot, fixed size, no overlap. */
  | 'free';

export interface Dimension {
  readonly name: string;
  readonly size: number;
  readonly risk: ClashRisk;
  readonly note: string;
}

/**
 * The sigil's dimensions. Sizes are the contract: `frozenTable()` throws when a
 * populated table's length disagrees, and `sigilSpace()` is asserted against a
 * floor in the tests -- so trimming a table for taste cannot quietly push
 * collisions up without someone seeing the number move.
 */
export const SIGIL_DIMENSIONS: readonly Dimension[] = [
  { name: 'shield', size: 12, risk: 'free',
    note: 'Outline only. Cannot clash with anything it contains.' },
  { name: 'tincturePair', size: 24, risk: 'curated',
    note: 'Field + charge colours, contrast-checked as a pair, both themes.' },
  { name: 'ordinary', size: 10, risk: 'curated',
    note: 'Geometric band under the charge. Curated for charge legibility.' },
  { name: 'charge', size: 192, risk: 'curated',
    note: 'game-icons.net paths that still read at 28px. Most of the 4,000 do not.' },
  { name: 'cadency', size: 16, risk: 'free',
    note: 'Small mark, fixed corner, never overlaps. This is the free distinctness.' },
];

// NOTE: `chargeTincture` (3) used to be declared here and was never built. The
// declared product therefore claimed 3x the distinctness the composer actually
// produced, and the space-floor test passed on a number nothing rendered. The
// test now asserts declared == actual (see sigilCombinations), so a dimension
// cannot be claimed without existing.

export const sigilSpace = (): number =>
  SIGIL_DIMENSIONS.reduce((n, d) => n * d.size, 1);

/** Expected number of colliding pairs among `users`. Birthday approximation. */
export const expectedCollisions = (users: number, space: number): number =>
  (users * users) / (2 * space);

/**
 * Sprite accessories are NOT dimensions -- they are curated whole outfits.
 *
 * Slot multiplication (helm x cloak x weapon x familiar) is exactly the case
 * where free combinatorics produces clipping helms and familiars fighting the
 * silhouette. Worse, `spriteAccessory` is permanent, so a bad combination is
 * permanent too. A loadout is one hand-authored, hand-checked set per class,
 * drawn whole. Fewer outcomes, all of them shippable, and the sigil is already
 * carrying the distinctness.
 */
export interface Loadout {
  readonly id: string;
  readonly helm: string | null;
  readonly cloak: string | null;
  readonly weapon: string | null;
  readonly familiar: string | null;
}

/** Per class. Draw the set, never the slots. */
export type LoadoutTable = FrozenTable<Loadout>;
