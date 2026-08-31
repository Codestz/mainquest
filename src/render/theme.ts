/**
 * The card's fixed visual language.
 *
 * A theme is a VALUE, not a set of module constants. That is the whole reason
 * light and still variants are possible without a second renderer: the layout
 * asks the theme for a colour rather than importing one.
 *
 * Within a theme the chrome is identical for every user — a
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
  /** Four seasonal sky palettes, top -> horizon. */
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
    ['#141B4D', '#1E2A6B', '#34367F'], // Q4  deep night (the reference palette)
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

/**
 * Text in the card's only font: `ui-monospace` (no embedded fonts — an SVG in
 * an <img> cannot load one, and base64-ing a pixel font pushes the file past
 * 200KB).
 *
 * With one family and one weight available, hierarchy has to come from SIZE,
 * CASE, TRACKING and COLOUR instead. The first version used none of them: nine
 * text sizes between 9 and 14px, everything lower-case, everything the same
 * weight — which read as unfinished rather than as a considered register.
 */
export interface TextOpts {
  /** Letter-spacing in px. Headers open up; body text stays at 0. */
  track?: number;
  /** Right-align to `x` instead of left. Numbers want this. */
  anchor?: 'start' | 'middle' | 'end';
  opacity?: number;
}

export const text = (
  x: number, y: number, s: string, size: number, fill: string, o: TextOpts = {},
): string =>
  `<text x="${x}" y="${y}" font-family="ui-monospace,monospace" font-size="${size}" ` +
  `fill="${fill}"` +
  (o.track ? ` letter-spacing="${o.track}"` : '') +
  (o.anchor && o.anchor !== 'start' ? ` text-anchor="${o.anchor}"` : '') +
  (o.opacity !== undefined ? ` opacity="${o.opacity}"` : '') +
  `>${esc(s)}</text>`;

/**
 * The type scale. Five steps, not nine — each has one job.
 *
 * Monospace gives no small-caps, so a "header" is uppercase plus tracking.
 * That is the one move that reads as deliberate in a single-weight font.
 */
export const TYPE = {
  /** The login. The largest thing on the card. */
  name: 15,
  /** Class, rank — the identity line. */
  identity: 12,
  /** Section headers: ABILITIES. Uppercased and tracked by the caller. */
  header: 11,
  /** Ability names, effect prose. */
  body: 12,
  /** Epithets, metric names, counts. */
  detail: 10,
  /** Provenance, caveats, the seal. */
  fine: 9,
} as const;

/** Section headers are upper-case and tracked — the only such move available. */
export const header = (x: number, y: number, s: string, fill: string): string =>
  text(x, y, s.toUpperCase(), TYPE.header, fill, { track: 2 });

/**
 * Title Case for proper nouns: class names, ranks.
 *
 * `\b[a-z]` was wrong the moment a locale had an accent in it. JavaScript's
 * `\b` is ASCII-only, so `ñ` and `á` count as NON-word characters and create
 * a boundary: "ermitaño" came out "ErmitañO" and "solitário" came out
 * "SolitáRio". Anchoring on whitespace with a Unicode letter class instead
 * capitalises exactly the first letter of each word, in any script.
 */
export const title = (s: string): string =>
  s.replace(/(^|\s)(\p{L})/gu, (_, lead: string, ch: string) => lead + ch.toUpperCase());

/**
 * Classic JRPG menu chrome.
 *
 * Square corners, double border, identical for every user. The first
 * version was exactly that and no more, which read as a plain rectangle rather
 * than a menu. Three cheap additions fix it without leaving the genre:
 *
 *   - corner brackets, the standard JRPG menu tell
 *   - a one-pixel inner highlight along the top edge, for depth
 *   - an optional title tab, so a window can name itself
 *
 * Still square, still two borders, still identical across users — just built
 * rather than drawn.
 */
export const window = (
  th: Theme, x: number, y: number, w: number, h: number, label?: string,
): string => {
  const C = 7; // corner bracket arm length
  const bracket = (cx: number, cy: number, dx: number, dy: number): string =>
    `<path d="M${cx + dx * C} ${cy} L${cx} ${cy} L${cx} ${cy + dy * C}" ` +
    `fill="none" stroke="${th.accent}" stroke-width="2" opacity=".9"/>`;

  let out =
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${th.win}" ` +
    `stroke="${th.ink}" stroke-width="2"/>` +
    // Inner highlight: one line under the top border reads as a lit bevel.
    `<line x1="${x + 3}" y1="${y + 3}" x2="${x + w - 3}" y2="${y + 3}" ` +
    `stroke="${th.ink}" stroke-width="1" opacity=".25"/>` +
    `<rect x="${x + 5}" y="${y + 5}" width="${w - 10}" height="${h - 10}" fill="none" ` +
    `stroke="${th.edge}" stroke-width="1"/>`;

  out += bracket(x + 3, y + 3, 1, 1) + bracket(x + w - 3, y + 3, -1, 1) +
         bracket(x + 3, y + h - 3, 1, -1) + bracket(x + w - 3, y + h - 3, -1, -1);

  if (label) {
    // A tab that overlaps the top border, the way a menu names a panel.
    // Width must account for the TRACKING, not just the glyphs: header() adds
    // 2px per character, so a 9-char label was 18px wider than the tab drawn
    // for it and rendered as "ABILITIE".
    const tw = label.length * (TYPE.header * 0.6 + 2) + 26;
    out += `<rect x="${x + 14}" y="${y - 9}" width="${tw}" height="18" fill="${th.win}" ` +
      `stroke="${th.ink}" stroke-width="2"/>` +
      header(x + 25, y + 4, label, th.accent);
  }
  return out;
};

/**
 * Whether this render may animate.
 *
 * The still variant is not "the animated one with the motion stripped":
 * it lists every ability at once, because there is no cursor to cycle
 * through them. Motion is a rendering mode, not a post-process.
 */
export interface Motion {
  animate: boolean;
}

export const MOVING: Motion = { animate: true };
export const STILL: Motion = { animate: false };
