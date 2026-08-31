/**
 * SVG has no text wrapping. An overflowing string just runs off the edge,
 * silently. Monospace makes width computable at build time — use it.
 */

const CHAR_RATIO = 0.6;  // ui-monospace advance width, approx
const SLACK = 0.9;       // ui-monospace resolves differently per OS

export function width(text: string, fontSize: number): number {
  return text.length * fontSize * CHAR_RATIO;
}

export function fits(text: string, fontSize: number, maxWidth: number): boolean {
  return width(text, fontSize) <= maxWidth * SLACK;
}

/** Every text slot in the layout declares its box. */
export const SLOTS = {
  'status.name':          { fontSize: 14, maxWidth: 220 },
  'status.epithet':       { fontSize: 11, maxWidth: 220 },
  'status.rankSubtitle':  { fontSize: 11, maxWidth: 220 },
  'ability.name':         { fontSize: 12, maxWidth: 160 },
  'desc.effectLine':      { fontSize: 12, maxWidth: 280 },
  'desc.measures':        { fontSize: 11, maxWidth: 280 },
  'desc.casts':           { fontSize: 11, maxWidth: 280 },
} as const;

/**
 * Run this over every locale × every slot in CI. A failure here is a build
 * error instead of a silently broken card in production.
 */
export function auditLocale(
  locale: Record<string, string>,
  slotOf: (key: string) => keyof typeof SLOTS,
): string[] {
  const failures: string[] = [];
  for (const [key, text] of Object.entries(locale)) {
    const slot = SLOTS[slotOf(key)];
    if (!slot) continue;
    if (!fits(text, slot.fontSize, slot.maxWidth)) {
      failures.push(`${key}: "${text}" overflows ${slot.maxWidth}px at ${slot.fontSize}px`);
    }
  }
  return failures;
}
