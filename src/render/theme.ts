/**
 * The card's fixed visual language: canvas size, palette, and the JRPG menu
 * chrome. Every user gets identical chrome — it is what makes the set read as
 * one game (docs/04), so nothing here is ever seeded or data-driven.
 */

export const W = 880;
export const H = 420;

export const WIN = '#16215C';
export const EDGE = '#6B8CE0';
export const INK = '#FFFFFF';
export const DIM = '#C6D4FF';
export const ACCENT = '#FFD866';
export const ROW = '#25317A';

export const esc = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export const t = (
  x: number, y: number, s: string, size: number, fill = INK, extra = '',
): string =>
  `<text x="${x}" y="${y}" font-family="ui-monospace,monospace" font-size="${size}" ` +
  `fill="${fill}"${extra}>${esc(s)}</text>`;

/** Classic JRPG menu chrome: square corners, double border, identical always. */
export const win = (x: number, y: number, w: number, h: number): string =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${WIN}" stroke="${INK}" stroke-width="2"/>` +
  `<rect x="${x + 5}" y="${y + 5}" width="${w - 10}" height="${h - 10}" fill="none" ` +
  `stroke="${EDGE}" stroke-width="1"/>`;
