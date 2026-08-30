/**
 * The four files a card actually ships as.
 *
 * README documents `<picture>` with a dark/light pair, and docs/06 requires a
 * no-motion variant. One renderer produces all four: theme is a value and
 * motion is a mode, so nothing here is a second implementation.
 *
 *   card-dark.svg         animated, dark
 *   card-light.svg        animated, light
 *   card-dark-still.svg   no motion, every ability listed at once
 *   card-light-still.svg  the same, light
 */

import { renderCard, type Card, type CardInput } from './card.js';
import { MOVING, STILL, type Theme } from './theme.js';

export interface Output {
  /** Filename without a directory: `card-dark.svg`. */
  file: string;
  theme: Theme['name'];
  animated: boolean;
  card: Card;
}

const VARIANTS: ReadonlyArray<{ theme: Theme['name']; animated: boolean }> = [
  { theme: 'dark', animated: true },
  { theme: 'light', animated: true },
  { theme: 'dark', animated: false },
  { theme: 'light', animated: false },
];

/**
 * Render every variant from one input.
 *
 * Deliberately not parameterised by "which variants": docs/06 lists four
 * outputs and the README's `<picture>` block breaks if any is missing. A
 * partial set is the failure mode worth preventing, not a feature.
 */
export function renderAll(input: CardInput): Output[] {
  return VARIANTS.map(({ theme, animated }) => ({
    file: `card-${theme}${animated ? '' : '-still'}.svg`,
    theme,
    animated,
    card: renderCard({ ...input, theme, motion: animated ? MOVING : STILL }),
  }));
}
