/**
 * Heraldic sigil composer.
 *
 * Draws in a 100x116 box: shield outline, field, ordinary, charge, cadency
 * mark. Every dimension is a frozen table (docs/07#7) drawn from the PERMANENT
 * identity lane, so a crest never changes for its owner.
 *
 * Curation rule (docs/04): dimensions that can visually clash are hand-checked;
 * dimensions that geometrically cannot are multiplied freely. Shield and
 * cadency are 'free' -- an outline and a fixed-corner mark cannot collide with
 * what they contain.
 */

import charges from '../../data/charges.v0.json' with { type: 'json' };
import { frozenTable, drawFrom, streamForAxis, type FrozenTable } from '../identity.js';

// --- tables ----------------------------------------------------------------

/** Outline only, so it cannot clash with the field or charge. */
const SHIELDS = frozenTable(1, 6, [
  'M6 4h88v52c0 30-20 46-44 56C26 102 6 86 6 56Z',                 // heater
  'M6 4h88v66c0 24-22 42-44 42S6 94 6 70Z',                        // round-base
  'M6 4h88v104H6Z',                                                 // square
  'M50 2 96 22v42c0 26-22 44-46 50C26 108 4 90 4 64V22Z',          // pointed
  'M6 4h88v50c0 34-30 42-44 58-14-16-44-24-44-58Z',                // spanish
  'M14 4h72c8 0 8 8 8 16v40c0 30-22 46-44 52C28 106 6 90 6 60V20c0-12 0-16 8-16Z', // curved
] as const);

/**
 * Geometric bands drawn under the charge, clipped to the shield. Curated: each
 * one leaves the centre readable, because the charge sits there.
 */
const ORDINARIES = frozenTable(1, 10, [
  '',                                        // plain field
  'M0 44h100v28H0Z',                         // fess
  'M36 0h28v116H36Z',                        // pale
  'M0 0h100v26H0Z',                          // chief
  'M0 90h100v26H0Z',                         // base
  'M0 0 30 0 100 96v20H70Z',                 // bend
  'M36 0h28v116H36Z M0 44h100v28H0Z',        // cross
  'M50 30 100 90v26H74L50 74 26 116H0V90Z',  // chevron
  'M0 0h100v10H0Z M0 106h100v10H0Z',         // two bars
  'M0 0h10v116H0Z M90 0h10v116H90Z',         // pallets
] as const);

/**
 * Tincture pairs: [field, charge]. Contrast-checked as pairs, and kept inside
 * the card's own palette so the crest belongs to the same world as the chrome.
 */
const TINCTURES = frozenTable<readonly [string, string]>(1, 24, [
  ['#7A1E2B', '#F2E4C0'], ['#1E3A6B', '#F2E4C0'], ['#25543A', '#F2E4C0'],
  ['#4A2A5E', '#F2E4C0'], ['#1A1A22', '#F2E4C0'], ['#8A5A18', '#F2E4C0'],
  ['#F2E4C0', '#7A1E2B'], ['#F2E4C0', '#1E3A6B'], ['#F2E4C0', '#25543A'],
  ['#F2E4C0', '#4A2A5E'], ['#F2E4C0', '#1A1A22'], ['#C6D4FF', '#16215C'],
  ['#16215C', '#FFD866'], ['#7A1E2B', '#FFD866'], ['#1A1A22', '#FFD866'],
  ['#25543A', '#FFD866'], ['#4A2A5E', '#FFD866'], ['#1E3A6B', '#FFD866'],
  ['#2B2258', '#C6D4FF'], ['#1B1540', '#7FD152'], ['#0F2A1C', '#7FD152'],
  ['#3A1420', '#E0708A'], ['#123043', '#6FD0E0'], ['#2A1E08', '#E8B84B'],
] as const);

/** Small mark, fixed corner, fixed size. Cannot overlap the charge. */
const CADENCY = frozenTable(1, 12, [
  '', 'M0-7 2-2h5l-4 4 1 5-4-3-4 3 1-5-4-4h5Z',              // none, mullet
  'M0-6a6 6 0 1 0 4 11 7 7 0 1 1-4-11Z',                     // crescent
  'M-6-6h12v3h-4v9h-4v-9h-4Z',                               // label
  'M0-6a6 6 0 1 1 0 12 6 6 0 1 1 0-12Zm0 3a3 3 0 1 0 0 6 3 3 0 1 0 0-6Z', // annulet
  'M0-7 3 0l7 0-5 4 2 7-7-4-7 4 2-7-5-4 7 0Z',               // estoile
  'M-5-5h10v10h-10Z',                                        // billet
  'M0-6 6 0 0 6-6 0Z',                                       // lozenge
  'M-6-2h12v4h-12Z M-2-6h4v12h-4Z',                          // cross
  'M0-6c3 3 3 6 0 6-3 0-3-3 0-6Z M-6 0c3-3 6-3 6 0 0 3-3 3-6 0Z', // fleur (part)
  'M0-6a3 3 0 1 1 0 6 3 3 0 1 1 0-6Z M0 0a3 3 0 1 1 0 6 3 3 0 1 1 0-6Z', // two roundels
  'M-6 4 0-6 6 4Z',                                          // pile
] as const);

const CHARGES: FrozenTable<{ id: string; author: string; name: string; d: string }> =
  frozenTable(charges.version, charges.size,
    charges.items as [(typeof charges.items)[number], ...(typeof charges.items)[number][]]);

// --- composition -----------------------------------------------------------

export interface Sigil {
  svg: string;
  /** For ATTRIBUTION.md: CC BY 3.0 requires naming the icon's author. */
  credit: { id: string; author: string };
}

export function composeSigil(login: string, campaign: number, size = 44): Sigil {
  // One lane, drawn in a fixed order. Adding a dimension later shifts this
  // stream -- which is exactly why the tables are frozen and versioned.
  const rnd = streamForAxis(login, campaign, 'sigil');
  const shield = drawFrom(rnd, SHIELDS);
  const [field, ink] = drawFrom(rnd, TINCTURES);
  const ordinary = drawFrom(rnd, ORDINARIES);
  const charge = drawFrom(rnd, CHARGES);
  const cadency = drawFrom(rnd, CADENCY);

  const clip = `sh${Math.abs(hash(login + campaign))}`;
  const svg =
    `<svg viewBox="0 0 100 116" width="${size}" height="${Math.round(size * 1.16)}">` +
    `<defs><clipPath id="${clip}"><path d="${shield}"/></clipPath></defs>` +
    `<path d="${shield}" fill="${field}"/>` +
    (ordinary ? `<path d="${ordinary}" fill="${ink}" opacity=".35" clip-path="url(#${clip})"/>` : '') +
    // charge: 512-space icon scaled into the shield's centre
    `<g clip-path="url(#${clip})" transform="translate(20 26) scale(0.117)">` +
    `<path d="${charge.d}" fill="${ink}"/></g>` +
    (cadency ? `<g transform="translate(78 22)" fill="${ink}"><path d="${cadency}"/></g>` : '') +
    `<path d="${shield}" fill="none" stroke="#FFFFFF" stroke-width="3"/>` +
    `</svg>`;

  return { svg, credit: { id: charge.id, author: charge.author } };
}

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(h, 31) + s.charCodeAt(i)) | 0;
  return h;
}

/** Total distinct crests this table set can produce. Asserted in tests. */
export const sigilCombinations = (): number =>
  SHIELDS.size * TINCTURES.size * ORDINARIES.size * CHARGES.size * CADENCY.size;
