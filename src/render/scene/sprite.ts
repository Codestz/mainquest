import SPRITES from '../../../data/sprites.v2.json' with { type: 'json' };
import type { ClassName } from '../../derive.js';

export interface Sprite { w: number; h: number; bytes: number; dataUri: string }
const FAMILIAR_TABLE = SPRITES.familiars as Record<string, Sprite>;
const CLASS_TABLE = SPRITES.classes as Record<string, Sprite>;
export const FAMILIARS = Object.keys(FAMILIAR_TABLE) as [string, ...string[]];

/**
 * The character, standing on the ground line.
 *
 * `spriteBase` is data (your class); the `familiar` beside it is seed, drawn
 * from the PERMANENT identity lane — so your companion is yours for as long as
 * the login exists, the same rule as the crest (docs/07#7).
 *
 * Both are base64 PNGs inlined as data URIs: an SVG in an <img> cannot load
 * anything external (docs/04). `image-rendering: pixelated` is mandatory — a
 * 40px sprite scaled up without it is blurred to mush.
 */
export function sprite(
  x: number,
  groundY: number,
  klass: ClassName | 'novice',
  familiarKey: string,
  scale = 2,
  th?: { shadow: string },
  motion?: { animate: boolean },
): string {
  const c = CLASS_TABLE[klass]!;
  const f = FAMILIAR_TABLE[familiarKey];
  const w = c.w * scale, h = c.h * scale;

  let out = `<g>`;
  out += `<ellipse cx="${x}" cy="${groundY + 2}" rx="${Math.round(w * 0.42)}" ry="5" fill="${th?.shadow ?? '#0B1A10'}" opacity=".45"/>`;

  // Idle bob: small, slow, and the only motion on the character (docs/04's
  // animation budget — everything that loops must be cheap).
  const bob = motion?.animate === false ? '' :
    `<animateTransform attributeName="transform" type="translate" ` +
    `values="0 0; 0 -3; 0 0" dur="1.9s" repeatCount="indefinite" calcMode="spline" ` +
    `keySplines="0.4 0 0.6 1; 0.4 0 0.6 1" keyTimes="0;0.5;1"/>`;
  out += `<g>${bob}` +
    `<image href="${c.dataUri}" x="${Math.round(x - w / 2)}" y="${groundY - h}" ` +
    `width="${w}" height="${h}" image-rendering="pixelated"/></g>`;

  if (f) {
    const fw = f.w * (scale - 0.6), fh = f.h * (scale - 0.6);
    // Offset phase so the pair never bobs in unison — two things moving on the
    // same beat reads as one object.
    const float = motion?.animate === false ? '' :
      `<animateTransform attributeName="transform" type="translate" ` +
      `values="0 0; 0 -5; 0 0" dur="2.7s" begin="-0.9s" repeatCount="indefinite" ` +
      `calcMode="spline" keySplines="0.4 0 0.6 1; 0.4 0 0.6 1" keyTimes="0;0.5;1"/>`;
    out += `<g>${float}` +
      `<image href="${f.dataUri}" x="${Math.round(x + w / 2 + 6)}" ` +
      `y="${Math.round(groundY - h * 0.85)}" width="${Math.round(fw)}" height="${Math.round(fh)}" ` +
      `image-rendering="pixelated" opacity=".95"/></g>`;
  }
  return out + `</g>`;
}
