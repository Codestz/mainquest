/**
 * The card's fixed visual language.
 *
 * A theme is a VALUE, not a set of module constants. That is the whole reason
 * light and still variants are possible without a second renderer: the layout
 * asks the theme for a colour rather than importing one.
 *
 * Within a theme the chrome is identical for every user — docs/04's
 * non-negotiable rule, and what makes the set read as one game. The theme axis
 * is the viewer's preference, which is a different thing entirely from the
 * per-user seeding the identity layer does.
 */

export const W = 880;
export const H = 420;

export interface Theme {
  name: 'dark' | 'light';
  /** JRPG menu chrome. */
  win: string;
  edge: string;
  ink: string;
  dim: string;
  accent: string;
  row: string;
  /** Debuff text — the honest half (VISION), so it must stay legible. */
  warn: string;
  /** Four seasonal sky palettes, top -> horizon (docs/07#3). */
  seasons: ReadonlyArray<readonly [string, string, string]>;
  /** The generated horizon ridge. */
  mountain: string;
  /** Contribution grid, empty -> densest. */
  terrain: readonly [string, string, string, string];
  /** Ground shadow under the character. */
  shadow: string;
  /** Background stars: decorative, and 'fixed' so only meaning moves. */
  star: string;
}

export const DARK: Theme = {
  name: 'dark',
  win: '#16215C', edge: '#6B8CE0', ink: '#FFFFFF', dim: '#C6D4FF',
  accent: '#FFD866', row: '#25317A', warn: '#E0708A',
  seasons: [
    ['#2A2350', '#5A3E6F', '#B8705E'], // Q1  cold dawn
    ['#1E4E7A', '#3F7FA8', '#7FB8CE'], // Q2  clear day
    ['#2B2350', '#6B3A5C', '#C4703F'], // Q3  dusk
    ['#141B4D', '#1E2A6B', '#34367F'], // Q4  deep night (docs/04 reference)
  ],
  mountain: '#2B2258',
  terrain: ['#1B3320', '#2A5A32', '#4E9E3A', '#7FD152'],
  shadow: '#0B1A10',
  star: '#F2F0D8',
};

/**
 * Daylight, not "dark inverted".
 *
 * Flipping the chrome and keeping a midnight sky would read as a bug. The
 * light card is the same world at a different hour: pale sky, hazy ridge,
 * parchment menus with dark ink — the JRPG manual rather than the screen.
 *
 * The sprites are unchanged. They carry their own baked palette and are the
 * one element that must look identical in both themes, or the character stops
 * being the same character.
 */
export const LIGHT: Theme = {
  name: 'light',
  win: '#EDE7D6', edge: '#9A8B6A', ink: '#22201A', dim: '#5C5647',
  accent: '#9A6212', row: '#DCD3BC', warn: '#9E2B45',
  seasons: [
    ['#BFD3E8', '#DCC9D6', '#F0C9A8'], // Q1  cold dawn
    ['#9FC8E8', '#C4DDF0', '#E8F0F5'], // Q2  clear day
    ['#C9C0DC', '#E8C4A8', '#F2D9B8'], // Q3  dusk
    ['#A8B4D0', '#C6CFE0', '#E0E4EC'], // Q4  pale winter
  ],
  mountain: '#8E93B5',
  terrain: ['#D6DCC8', '#9CC28A', '#5EA544', '#2F7A2A'],
  shadow: '#7A8A6A',
  star: '#FFFFFF',
};

export const THEMES: Record<Theme['name'], Theme> = { dark: DARK, light: LIGHT };

export const esc = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Text in the card's only font: `ui-monospace` (docs/04 — no embedded fonts). */
export const text = (
  x: number, y: number, s: string, size: number, fill: string,
): string =>
  `<text x="${x}" y="${y}" font-family="ui-monospace,monospace" font-size="${size}" ` +
  `fill="${fill}">${esc(s)}</text>`;

/** Classic JRPG menu chrome: square corners, double border, identical always. */
export const window = (th: Theme, x: number, y: number, w: number, h: number): string =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${th.win}" ` +
  `stroke="${th.ink}" stroke-width="2"/>` +
  `<rect x="${x + 5}" y="${y + 5}" width="${w - 10}" height="${h - 10}" fill="none" ` +
  `stroke="${th.edge}" stroke-width="1"/>`;

/**
 * Whether this render may animate.
 *
 * The still variant is not "the animated one with the motion stripped": docs/04
 * says it lists every ability at once, because there is no cursor to cycle
 * through them. Motion is a rendering mode, not a post-process.
 */
export interface Motion {
  animate: boolean;
}

export const MOVING: Motion = { animate: true };
export const STILL: Motion = { animate: false };
