/**
 * What the character gives off, and what the rank is worth.
 *
 * The sprites were "just floating" — a figure pasted onto a landscape rather
 * than standing in one. Two things fix that without new art: something in the
 * air AROUND the character that belongs to their class, and something on the
 * ground UNDER them that belongs to their rank.
 *
 * Both are derived, never seeded. Ambience is a function of class, which is a
 * function of the contribution shape; the aura is a function of rank. Neither
 * is ornament, so neither draws from the identity lanes.
 */

import type { ClassName } from '../../derive.js';
import type { Theme } from '../theme.js';
import { clipRect, field } from './field.js';

/**
 * Five behaviours, not twelve.
 *
 * One bespoke emitter per class would be twelve near-identical particle
 * routines and twelve chances to look inconsistent. Behaviour is shared;
 * COLOUR is what makes a necromancer's motes read differently from a mage's.
 * The same curation rule the sigil tables use: curate what can clash, multiply
 * what cannot.
 */
type Ambience = 'embers' | 'motes' | 'leaves' | 'dust' | 'sparks';

interface Ambient {
  kind: Ambience;
  /** The class's own colour in the air. */
  hue: string;
}

const AMBIENCE: Record<ClassName, Ambient> = {
  // commits — one burns, one grinds
  berserker:   { kind: 'embers', hue: '#FF9A4D' },
  warrior:     { kind: 'dust',   hue: '#C9B78F' },
  // reviews — one tends, one grows
  healer:      { kind: 'motes',  hue: '#8FE6A8' },
  druid:       { kind: 'leaves', hue: '#7FD152' },
  // merges — one closes, one slips
  finisher:    { kind: 'sparks', hue: '#FFD866' },
  rogue:       { kind: 'sparks', hue: '#6FE3D0' },
  // streak — one holds the wall, one holds the hill
  sentinel:    { kind: 'dust',   hue: '#9FB4E8' },
  hermit:      { kind: 'motes',  hue: '#E8C98F' },
  // repos — one builds, one passes through
  mage:        { kind: 'motes',  hue: '#B98FE6' },
  wanderer:    { kind: 'leaves', hue: '#8FD6C4' },
  // issues — one tracks, one raises
  tracker:     { kind: 'leaves', hue: '#D6A86F' },
  necromancer: { kind: 'motes',  hue: '#A8E67F' },
};

/** Per-behaviour motion. The hue comes from the class, the physics from here. */
const MOTION: Record<Ambience, { count: number; size: number; dir: 'up' | 'down'; dx: number; dur: number; opacity: number }> = {
  embers: { count: 18, size: 2, dir: 'up',   dx: 5,   dur: 6.5, opacity: 0.85 },
  sparks: { count: 14, size: 2, dir: 'up',   dx: -4,  dur: 4.5, opacity: 0.9 },
  motes:  { count: 16, size: 2, dir: 'up',   dx: 3,   dur: 11,  opacity: 0.8 },
  leaves: { count: 15, size: 2, dir: 'down', dx: -6,  dur: 9,   opacity: 0.8 },
  dust:   { count: 16, size: 2, dir: 'down', dx: 7,   dur: 13,  opacity: 0.6 },
};

/** A stable per-class salt, so a druid's leaves fall the same way every render. */
const salt = (s: string): number => {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(h, 31) + s.charCodeAt(i)) | 0;
  return h;
};

/**
 * The air around the character.
 *
 * Two layers at different speeds and depths: the far one dimmer and slower.
 * One layer reads as a bug ("why are there dots?"); two read as depth.
 *
 * Costs two animated elements regardless of particle count — see field.ts.
 */
export function ambience(
  klass: ClassName, cx: number, groundY: number, animate: boolean,
): string {
  const a = AMBIENCE[klass];
  const m = MOTION[a.kind];
  const w = 116, h = 104;
  const x = Math.round(cx - w / 2);
  const y = groundY - h + 8;
  const id = `am${Math.abs(salt(klass))}`;

  return `<defs>${clipRect(id, x, y, w, h)}</defs>` +
    // Far layer: smaller, dimmer, slower. Drawn first so it sits behind.
    field(id, {
      x, y, w, h, count: Math.round(m.count * 0.7), size: Math.max(1, m.size - 1),
      colour: a.hue, opacity: m.opacity * 0.5, dir: m.dir, dx: Math.round(m.dx * 0.5),
      dur: m.dur * 1.6, salt: salt(klass) ^ 0x5f,
    }, animate) +
    field(id, {
      x, y, w, h, count: m.count, size: m.size,
      colour: a.hue, opacity: m.opacity, dir: m.dir, dx: m.dx,
      dur: m.dur, begin: m.dur / 3, salt: salt(klass),
    }, animate);
}

const RANKS = ['apprentice', 'journeyman', 'veteran', 'master', 'archon'];

/**
 * `rank` on the ground, not in the text.
 *
 * The rank was a word in the identity line and nothing else, so it carried no
 * weight — a Master looked exactly like an Apprentice. Concentric rings of
 * light at the feet is the JRPG grammar for standing, and it costs one
 * animated element for the whole set.
 *
 * An apprentice gets NOTHING. That matters: if every rank draws a ring, the
 * ring stops meaning rank and starts meaning "character".
 */
export function rankAura(
  rk: string, cx: number, groundY: number, th: Theme, animate: boolean,
): string {
  const rings = Math.max(0, RANKS.indexOf(rk));
  if (rings === 0) return '';

  let out = '';
  for (let n = 0; n < rings; n++) {
    const rx = 26 + n * 11;
    out += `<ellipse cx="${cx}" cy="${groundY + 2}" rx="${rx}" ry="${Math.round(rx * 0.3)}" ` +
      `fill="none" stroke="${th.accent}" stroke-width="1" ` +
      `opacity="${(0.5 - n * 0.11).toFixed(2)}"/>`;
  }
  return animate
    ? `<g><animate attributeName="opacity" values=".65;1;.65" dur="3.4s" ` +
      `repeatCount="indefinite"/>${out}</g>`
    : `<g>${out}</g>`;
}
