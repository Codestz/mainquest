/**
 * The second card: every ability, big and legible.
 *
 * The status card is a SCENE — it has a sky, a character, a horizon made of
 * your year, and it can only afford to name four of your eight abilities in
 * type small enough to fit beside all that. This card is the opposite trade:
 * no scene at all, one column, all eight, in type you can read at a glance.
 *
 * The pair is deliberate. Someone who wants the game gets the first; someone
 * who wants the numbers gets the second; a README can embed either or both.
 *
 * It does not animate. There is nothing here to cycle through — everything is
 * already on screen, which is the entire point of the card.
 */

import en from '../../locales/en.json' with { type: 'json' };
import { DISTRIBUTION } from '../normalise.js';
import type { Card, CardInput } from './card.js';
import { characterSheet } from './sheet.js';
import { sprite } from './scene/sprite.js';
import {
  DARK, THEMES, TYPE, W, esc, header, text, title, window as menu, type Theme,
} from './theme.js';

/** Taller than the status card: eight rows of three lines each need the room. */
export const ABILITIES_H = 620;

const ROW_H = 53;
const ROWS_TOP = 114;
/** Where the right-hand readout block starts. Text must stop before it. */
const GUTTER = 596;
const RIGHT = 844;
/** Header text stops here: the portrait occupies the rest of the frame. */
const HEAD_TEXT = 744;

export function renderAbilities(i: CardInput): Card {
  const L = en;
  const th: Theme = THEMES[i.theme ?? 'dark'] ?? DARK;
  const sh = characterSheet(i);
  const t = (
    x: number, y: number, s: string, size: number, fill = th.ink,
    o?: Parameters<typeof text>[5],
  ): string => text(x, y, s, size, fill, o);

  let s = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${ABILITIES_H}" ` +
    `viewBox="0 0 ${W} ${ABILITIES_H}" role="img">`;
  s += `<title>${esc(i.login)} — ability sheet: all eight abilities with their ` +
    `measures, counts and percentile in the sample</title>`;
  s += `<desc>The companion to the MainQuest status card. Same derived data, ` +
    `laid out for reading rather than for atmosphere.</desc>`;
  s += `<metadata><![CDATA[Heraldic charge "${esc(sh.sigil.credit.id.split('/')[1] ?? '')}" by ` +
    `${esc(sh.sigil.credit.author)} from game-icons.net (https://game-icons.net), ` +
    `licensed CC BY 3.0 (https://creativecommons.org/licenses/by/3.0/). ` +
    `Recoloured and composited into a heraldic sigil by MainQuest.]]></metadata>`;

  // A flat ground rather than a sky. This card is a document, not a place —
  // giving it a horizon would make it compete with the card it accompanies.
  s += `<rect width="${W}" height="${ABILITIES_H}" fill="${th.seasons[3]![0]}"/>`;

  // --- header ---------------------------------------------------------------
  s += menu(th, 16, 16, 848, 64);
  s += `<g transform="translate(26 26)">${sh.sigil.svg}</g>`;
  s += t(84, 44, i.login, TYPE.name, th.ink, { track: 0.5 });
  s += t(84, 62, identity(sh, L), TYPE.identity, th.accent);

  // The same character, at half the scale and standing still. It is the only
  // thing tying this card to the other one at a glance.
  // Far right, inside the frame. The portrait and the header text used to
  // share the same 40px: the seal rendered straight through the character.
  // Scale 1.4, not 1. At 1 the familiar resolves to an eight-pixel smudge —
  // and a companion nobody can identify is worse than no companion.
  if (sh.classified) s += sprite(790, 76, sh.klass, sh.familiar, 1.4, th, { animate: false });

  s += t(HEAD_TEXT, 40, `${L.ui.campaign.replace('{year}', String(i.campaign))} · day ${i.campaignDay}`,
    TYPE.fine, th.dim, { anchor: 'end', opacity: 0.85 });
  s += t(HEAD_TEXT, 56, sh.seal, TYPE.fine, th.edge, { anchor: 'end' });

  // --- the eight ------------------------------------------------------------
  s += menu(th, 16, 96, 848, 452, L.ui.abilities);

  sh.abilities.forEach((a, n) => {
    const top = ROWS_TOP + n * ROW_H;
    const ab = L.abilities[a.key];

    // Zebra banding. Eight rows of three lines each is exactly the density at
    // which the eye starts reading across the gap between two rows.
    if (n % 2 === 1) {
      s += `<rect x="26" y="${top}" width="828" height="${ROW_H - 4}" ` +
        `fill="${th.row}" opacity=".45"/>`;
    }
    // A tick whose height IS the tier — a third scale reading of the same
    // number as the pips and the bar, and the one you catch peripherally.
    if (a.tier > 0) {
      s += `<rect x="30" y="${top + 4 + (3 - a.tier) * 6}" width="3" ` +
        `height="${6 + a.tier * 6}" fill="${th.accent}" opacity=".8"/>`;
    }

    s += t(42, top + 17, ab.name, 13, th.ink, { track: 0.5 });
    s += t(42, top + 32, ab.effect, 11, th.dim);
    s += t(42, top + 45, `${L.ui.measures_prefix} ${ab.measures}`, 9, th.edge,
      { opacity: 0.85 });

    // Readout, right-aligned so the numbers form a column you can scan down.
    s += t(RIGHT, top + 20, a.readout, 15, th.accent, { anchor: 'end' });

    for (let k = 0; k < 3; k++) {
      s += `<rect x="${GUTTER + k * 14}" y="${top + 8}" width="11" height="11" ` +
        `fill="${k < a.tier ? th.accent : th.edge}" ` +
        `opacity="${k < a.tier ? 1 : 0.25}"/>`;
    }

    const bw = 180;
    const fill = Math.max(2, Math.round(bw * a.p));
    s += `<rect x="${GUTTER}" y="${top + 30}" width="${bw}" height="8" fill="${th.row}"/>` +
      `<rect x="${GUTTER}" y="${top + 30}" width="${fill}" height="8" fill="${th.accent}"/>` +
      `<rect x="${GUTTER}" y="${top + 30}" width="${bw}" height="8" fill="none" ` +
      `stroke="${th.edge}" stroke-width="1" opacity=".5"/>`;
    /**
     * `p88`, not `top 12%`.
     *
     * "Top 12%" is the friendlier phrasing right up until the percentile is
     * low, at which point the card tells someone they are in the "top 95%" of
     * GitHub accounts — an insult the RPG framing was specifically built to
     * avoid. A percentile label is neutral at both ends of the scale.
     */
    s += t(RIGHT, top + 38, `p${Math.round(a.p * 100)}`, 9, th.dim, { anchor: 'end' });
  });

  // --- footer ---------------------------------------------------------------
  s += menu(th, 16, 560, 848, 44);
  if (sh.debuffs.length) {
    s += header(30, 584, 'debuffs', th.warn);
    s += t(120, 584, sh.debuffs
      .map((d) => title(L.debuffs[d as keyof typeof L.debuffs].name)).join(' · '),
      11, th.warn);
  } else {
    s += t(30, 584, 'no debuffs', 11, th.edge, { opacity: 0.8 });
  }
  // What the bars are measured against. The card shows a percentile on every
  // row, so it owes the reader the denominator.
  s += t(RIGHT, 578, `p = percentile against n=${DISTRIBUTION.sampleSize} sampled accounts`,
    9, th.edge, { anchor: 'end' });
  s += t(RIGHT, 592, `${DISTRIBUTION.generated} · campaign ${i.campaign}`,
    9, th.edge, { anchor: 'end', opacity: 0.7 });

  s += `</svg>`;
  return { svg: s, credit: sh.sigil.credit, klass: sh.klass };
}

/** The identity line, saying only what the standing entitles it to say. */
function identity(sh: ReturnType<typeof characterSheet>, L: typeof en): string {
  const rk = title(L.ranks[sh.rank as keyof typeof L.ranks]);
  if (sh.classified) return `${title(L.classes[sh.klass].name)} · ${rk}`;
  if (sh.state === 'sealed') return `Sealed · ${rk}`;
  return 'Unclassed';
}
