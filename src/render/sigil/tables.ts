/**
 * The frozen tables the crest is drawn from.
 *
 * Every one is a `frozenTable`: the declared size is part of the table and a
 * drift throws at load. These feed the PERMANENT identity lane, so editing a
 * list in place silently redraws every existing user's crest — additions ship
 * as a new version, never as an edit.
 */

import charges from '../../../data/charges.v1.json' with { type: 'json' };
import { frozenTable, type FrozenTable } from '../../identity/index.js';
import type { Flourish } from '../../identity/index.js';

/** Heraldic metals. Reserved for the flourish, so they always read as "rare". */
export const METALS: Record<Exclude<Flourish, 'plain'>, string> = {
  burnished: '#C9CBD4',  // argent
  gilded: '#E8B84B',     // or
  shiny: '#FFF2B0',      // or, brighter — paired with the glint
};

// --- tables ----------------------------------------------------------------

/** Outline only, so it cannot clash with the field or charge. */
export const SHIELDS = frozenTable(1, 12, [
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
export const ORDINARIES = frozenTable(1, 10, [
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
export const TINCTURES = frozenTable<readonly [string, string]>(1, 24, [
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
export const CADENCY = frozenTable(1, 16, [
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

export const CHARGES: FrozenTable<{ id: string; author: string; name: string; d: string }> =
  frozenTable(charges.version, charges.size,
    charges.items as [(typeof charges.items)[number], ...(typeof charges.items)[number][]]);

/** Total distinct crests this table set can produce. Asserted in tests. */
export const sigilCombinations = (): number =>
  SHIELDS.size * TINCTURES.size * ORDINARIES.size * CHARGES.size * CADENCY.size;
