/**
 * Curation model: which dimensions may be multiplied freely, and which must be
 * hand-reviewed. The rule: curate what can clash, multiply what cannot.
 */
import type { FrozenTable } from './tables.js';

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
