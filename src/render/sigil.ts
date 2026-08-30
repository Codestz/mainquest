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

import charges from '../../data/charges.v1.json' with { type: 'json' };
import {
  frozenTable, drawFrom, streamForAxis, drawFlourish,
  type FrozenTable, type Flourish,
} from '../identity.js';

/** Heraldic metals. Reserved for the flourish, so they always read as "rare". */
const METALS: Record<Exclude<Flourish, 'plain'>, string> = {
  burnished: '#C9CBD4',  // argent
  gilded: '#E8B84B',     // or
  shiny: '#FFF2B0',      // or, brighter — paired with the glint
};

// --- tables ----------------------------------------------------------------

/** Outline only, so it cannot clash with the field or charge. */
const SHIELDS = frozenTable(1, 12, [
  'M6 4h88v52c0 30-20 46-44 56C26 102 6 86 6 56Z',                 // heater
  'M6 4h88v66c0 24-22 42-44 42S6 94 6 70Z',                        // round-base
  'M6 4h88v104H6Z',                                                 // square
  'M50 2 96 22v42c0 26-22 44-46 50C26 108 4 90 4 64V22Z',          // pointed
  'M6 4h88v50c0 34-30 42-44 58-14-16-44-24-44-58Z',                // spanish
  'M14 4h72c8 0 8 8 8 16v40c0 30-22 46-44 52C28 106 6 90 6 60V20c0-12 0-16 8-16Z', // curved
  'M6 4h88v76c0 16-14 28-44 32C20 108 6 96 6 80Z',                 // deep heater
  'M6 12c14-8 30-8 44 0 14-8 30-8 44 0v46c0 30-20 46-44 56C26 104 6 88 6 58Z', // double-arch chief
  'M50 2l44 18v40c0 32-20 48-44 56C26 108 6 92 6 60V20Z',          // tall pointed
  'M6 4h88v40c0 40-26 52-44 64C32 96 6 84 6 44Z',                  // wide bottom
  'M18 4h64l12 16v44c0 28-22 44-44 52C28 108 6 92 6 64V20Z',       // cut corners
  'M6 4h88v58c0 26-18 40-44 52C24 102 6 88 6 62Z',                 // shallow
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
const CADENCY = frozenTable(1, 16, [
  '',                                                        // none
  'M0-7 2-2h5l-4 4 1 5-4-3-4 3 1-5-4-4h5Z',                  // mullet
  'M0-6a6 6 0 1 0 4 11 7 7 0 1 1-4-11Z',                     // crescent
  'M-6-6h12v3h-4v9h-4v-9h-4Z',                               // label
  'M0-6a6 6 0 1 1 0 12 6 6 0 1 1 0-12Zm0 3a3 3 0 1 0 0 6 3 3 0 1 0 0-6Z', // annulet
  'M0-7 3 0l7 0-5 4 2 7-7-4-7 4 2-7-5-4 7 0Z',               // estoile
  'M-5-5h10v10h-10Z',                                        // billet
  'M0-6 6 0 0 6-6 0Z',                                       // lozenge
  'M-6-2h12v4h-12Z M-2-6h4v12h-4Z',                          // cross
  'M0-6c3 3 3 6 0 6-3 0-3-3 0-6Z M-6 0c3-3 6-3 6 0 0 3-3 3-6 0Z', // fleur
  'M0-6a3 3 0 1 1 0 6 3 3 0 1 1 0-6Z M0 0a3 3 0 1 1 0 6 3 3 0 1 1 0-6Z', // two roundels
  'M-6 4 0-6 6 4Z',                                          // pile
  'M0-6a6 6 0 1 1 0 12 6 6 0 1 1 0-12Z',                     // roundel
  'M-6-6h12v12h-12Zm3 3h6v6h-6Z',                            // voided square
  'M0-7 4-1h-8Z M0 7 4 1h-8Z',                               // two piles
  'M-6-6 6 6M6-6-6 6',                                       // saltire couped
] as const);

const CHARGES: FrozenTable<{ id: string; author: string; name: string; d: string }> =
  frozenTable(charges.version, charges.size,
    charges.items as [(typeof charges.items)[number], ...(typeof charges.items)[number][]]);

// --- composition -----------------------------------------------------------

export interface Sigil {
  svg: string;
  flourish: Flourish;
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

  // Luck, not merit (see Flourish in identity.ts). It re-tints the charge and
  // adds chrome; it never changes WHICH charge you have, so a shiny and a plain
  // crest of the same login are recognisably the same coat of arms.
  const flourish = drawFlourish(login);
  const chargeInk = flourish === 'plain' ? ink : METALS[flourish];

  const uid = Math.abs(hash(login + campaign)).toString(36);
  const clip = `sh${uid}`;
  const glint = `gl${uid}`;

  let svg = `<svg viewBox="0 0 100 116" width="${size}" height="${Math.round(size * 1.16)}">`;
  svg += `<defs><clipPath id="${clip}"><path d="${shield}"/></clipPath>`;
  if (flourish === 'shiny') {
    // A slow diagonal sweep. Small and cheap: docs/04's animation budget says
    // everything that loops forever must be.
    svg += `<linearGradient id="${glint}" x1="0" y1="0" x2="1" y2="1">` +
      `<stop offset="0%" stop-color="#FFFFFF" stop-opacity="0"/>` +
      `<stop offset="45%" stop-color="#FFFFFF" stop-opacity="0"/>` +
      `<stop offset="50%" stop-color="#FFFFFF" stop-opacity=".75"/>` +
      `<stop offset="55%" stop-color="#FFFFFF" stop-opacity="0"/>` +
      `<stop offset="100%" stop-color="#FFFFFF" stop-opacity="0"/>` +
      `<animateTransform attributeName="gradientTransform" type="translate" ` +
      `values="-1 -1; 1 1; 1 1" dur="4.5s" repeatCount="indefinite"/></linearGradient>`;
  }
  svg += `</defs>`;

  svg += `<path d="${shield}" fill="${field}"/>`;
  // The ordinary is drawn in the same tincture as the charge, so at full
  // strength a charge sitting on the band disappears into it. Keep the band
  // faint: it is a field division, not a second charge.
  if (ordinary) svg += `<path d="${ordinary}" fill="${ink}" opacity=".22" clip-path="url(#${clip})"/>`;

  // Charge: a 512-space icon scaled into the shield's centre.
  //
  // The clip and the transform MUST live on separate groups. An element's own
  // `transform` also transforms its `clip-path`, so putting both on one <g>
  // scaled the shield-shaped clip region down by the same 0.117 and clipped
  // the charge away to a sliver.
  svg += `<g clip-path="url(#${clip})">` +
    `<g transform="translate(20 26) scale(0.117)">` +
    `<path d="${charge.d}" fill="${chargeInk}"/></g></g>`;

  if (cadency) svg += `<g transform="translate(78 22)" fill="${chargeInk}"><path d="${cadency}"/></g>`;

  if (flourish === 'gilded' || flourish === 'shiny') {
    svg += `<path d="${shield}" fill="none" stroke="${METALS.gilded}" stroke-width="6" opacity=".55"/>`;
  }
  if (flourish === 'shiny') {
    svg += `<path d="${shield}" fill="url(#${glint})" clip-path="url(#${clip})"/>`;
  }
  svg += `<path d="${shield}" fill="none" stroke="#FFFFFF" stroke-width="3"/></svg>`;

  return { svg, flourish, credit: { id: charge.id, author: charge.author } };
}

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(h, 31) + s.charCodeAt(i)) | 0;
  return h;
}

/** Total distinct crests this table set can produce. Asserted in tests. */
export const sigilCombinations = (): number =>
  SHIELDS.size * TINCTURES.size * ORDINARIES.size * CHARGES.size * CADENCY.size;
