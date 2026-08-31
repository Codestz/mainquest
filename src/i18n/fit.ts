/**
 * SVG has no text wrapping. An overflowing string just runs off the edge,
 * silently. Monospace makes width computable at build time — use it.
 *
 * This file is the ONE place slot budgets are declared.
 *
 * There used to be two. This module exported a `SLOTS` table that nothing
 * imported and an `auditLocale()` that nothing called, while test/fit.test.ts
 * defined its own table with different numbers — `desc.effectLine` was 280px
 * here and 620px there. The dead one looked authoritative and was wrong by
 * more than a factor of two, which is exactly how a layout change gets planned
 * against a budget that was never real.
 */

const CHAR_RATIO = 0.6;  // ui-monospace advance width, approx
const SLACK = 0.9;       // ui-monospace resolves differently per OS

export function width(text: string, fontSize: number): number {
  return text.length * fontSize * CHAR_RATIO;
}

export function fits(text: string, fontSize: number, maxWidth: number): boolean {
  return width(text, fontSize) <= maxWidth * SLACK;
}

/**
 * Every text slot in the layout declares its box, in px.
 *
 * These are measured from the renderer, not aspirational. Changing a number
 * here without moving the corresponding text in `card.ts` or `abilities.ts`
 * makes the tests agree with a card that does not exist.
 */
export const SLOTS = {
  /** Status window. */
  'status.epithet':         { size: 11, max: 220 },

  /** Animated status card: the cycling description window. */
  'desc.effect':            { size: 12, max: 620 },
  /**
   * The shape block's adjective, from x=516 to where the right-anchored
   * provenance stack begins. Its longest line is the private-work caveat,
   * which in pt-BR starts at roughly x=664 — so 148px, taken as 140.
   */
  'desc.shapeAdjective':    { size: 9,  max: 140 },

  /** Still status card: two columns of four abilities. */
  'still.ability.name':     { size: 11, max: 300 },
  'still.ability.measures': { size: 9,  max: 410 },

  /** Ability window on the status card. */
  'ability.name':           { size: 12, max: 200 },

  /**
   * The ability card: one full-width column, text stopping at the readout
   * gutter (x=596) from a left margin of x=42.
   */
  'sheet.ability.name':     { size: 13, max: 554 },
  'sheet.ability.effect':   { size: 11, max: 554 },
  'sheet.ability.measures': { size: 9,  max: 554 },
} as const;

export type Slot = keyof typeof SLOTS;

/** Does this string fit the named slot? */
export const fitsSlot = (text: string, slot: Slot): boolean =>
  fits(text, SLOTS[slot].size, SLOTS[slot].max);
