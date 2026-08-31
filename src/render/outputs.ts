/**
 * The files a profile ships as.
 *
 * README documents `<picture>` with a dark/light pair, and there has to be a
 * no-motion variant. One renderer produces all of them: theme is a value and
 * motion is a mode, so nothing here is a second implementation.
 *
 *   card-dark.svg          the scene, animated, dark
 *   card-light.svg         the scene, animated, light
 *   card-dark-still.svg    no motion, every ability listed at once
 *   card-light-still.svg   the same, light
 *   abilities-dark.svg     all eight abilities, large, no scene
 *   abilities-light.svg    the same, light
 */

import { renderAbilities } from './abilities.js';
import { renderCard, type Card, type CardInput } from './card.js';
import { MOVING, STILL, type Theme } from './theme.js';

/**
 * `status` is the scene; `abilities` is the reading copy.
 *
 * They are separate KINDS rather than another motion variant, because the
 * ability card has no motion to vary — everything on it is visible at once by
 * design. Filing it under `animated: false` would have meant a workflow that
 * asks for `motion: animated` silently loses the whole card.
 */
export type CardKind = 'status' | 'abilities';

export interface Output {
  /** Filename without a directory: `card-dark.svg`. */
  file: string;
  kind: CardKind;
  theme: Theme['name'];
  /** Always false for `abilities`. */
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
 * Deliberately not parameterised by "which variants": there are four
 * outputs and the README's `<picture>` block breaks if any is missing. A
 * partial set is the failure mode worth preventing, not a feature.
 */
export function renderAll(input: CardInput): Output[] {
  const status: Output[] = VARIANTS.map(({ theme, animated }) => ({
    file: `card-${theme}${animated ? '' : '-still'}.svg`,
    kind: 'status' as const,
    theme,
    animated,
    card: renderCard({ ...input, theme, motion: animated ? MOVING : STILL }),
  }));

  const abilities: Output[] = (['dark', 'light'] as const).map((theme) => ({
    file: `abilities-${theme}.svg`,
    kind: 'abilities' as const,
    theme,
    animated: false,
    card: renderAbilities({ ...input, theme }),
  }));

  return [...status, ...abilities];
}
