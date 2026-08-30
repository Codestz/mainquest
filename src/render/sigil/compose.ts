/**
 * Heraldic sigil composer.
 *
 * Draws in a 100x116 box: shield outline, field, ordinary, charge, cadency
 * mark, and the flourish that may re-tint them. Everything is drawn from the
 * permanent identity lane, so a crest never changes for its owner.
 */

import { drawFrom, drawFlourish, streamForAxis, type Flourish } from '../../identity/index.js';
import { CADENCY, CHARGES, METALS, ORDINARIES, SHIELDS, TINCTURES } from './tables.js';

export interface Sigil {
  svg: string;
  flourish: Flourish;
  /** For ATTRIBUTION.md: CC BY 3.0 requires naming the icon's author. */
  credit: { id: string; author: string };
}

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
