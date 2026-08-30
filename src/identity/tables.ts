/**
 * Frozen tables: the mechanism that makes a permanent draw safe to ship.
 *
 * Part of the identity layer. See src/identity/policy.ts for the rule that
 * governs all of it: seed owns what reads as heraldry, data owns what reads as
 * a chart, and the two never share a visual language.
 */

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
// `dist/mainquest.state.json`. Growing the catalogue means shipping v2 and
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
