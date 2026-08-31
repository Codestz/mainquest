import SPRITES from '../../../data/sprites.v3.json' with { type: 'json' };
import type { ClassName } from '../../derive.js';

export interface Sprite {
  /** ONE frame's width. The image is `w * frames` wide. */
  w: number;
  h: number;
  /** 1 for a static sprite, 2 for a two-frame idle sheet. */
  frames: number;
  bytes: number;
  dataUri: string;
}
const FAMILIAR_TABLE = SPRITES.familiars as Record<string, Sprite>;
const CLASS_TABLE = SPRITES.classes as Record<string, Sprite>;
export const FAMILIARS = Object.keys(FAMILIAR_TABLE) as [string, ...string[]];

/**
 * The character, standing on the ground line.
 *
 * `spriteBase` is data (your class); the `familiar` beside it is seed, drawn
 * from the PERMANENT identity lane — so your companion is yours for as long as
 * the login exists, the same rule as the crest.
 *
 * Both are base64 PNGs inlined as data URIs: an SVG in an <img> cannot load
 * anything external. `image-rendering: pixelated` is mandatory — a
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
  out += `<ellipse cx="${x}" cy="${groundY + 2}" rx="${Math.round(w * 0.42)}" ry="5" ` +
    `fill="${th?.shadow ?? '#0B1A10'}" opacity=".45"/>`;

  /**
   * Two-frame idle, via the clipPath trick.
   *
   * Both frames sit side by side in one image; a clip window one frame wide
   * shows only the first, and translateX steps the image left by exactly one
   * frame with `calcMode="discrete"` — no tweening, so it snaps the way a
   * sprite should rather than sliding.
   *
   * One <image> and one <animateTransform>: a single element against the
   * 40-element budget, where cross-fading two images would cost two and would
   * blend between frames instead of cutting.
   */
  const frames = c.frames ?? 1;
  const animated = motion?.animate !== false;
  const clipId = `f${Math.abs(hashName(familiarKey + klass + scale))}`;

  const bob = !animated ? '' :
    `<animateTransform attributeName="transform" type="translate" ` +
    `values="0 0; 0 -3; 0 0" dur="1.9s" repeatCount="indefinite" calcMode="spline" ` +
    `keySplines="0.4 0 0.6 1; 0.4 0 0.6 1" keyTimes="0;0.5;1"/>`;

  const left = Math.round(x - w / 2);
  const top = groundY - h;

  out += `<g>${bob}`;
  if (frames > 1 && animated) {
    out += `<defs><clipPath id="${clipId}">` +
      `<rect x="${left}" y="${top}" width="${w}" height="${h}"/></clipPath></defs>`;
    out += `<g clip-path="url(#${clipId})">` +
      `<g><animateTransform attributeName="transform" type="translate" ` +
      `values="0 0;${-w} 0" dur="1.9s" repeatCount="indefinite" calcMode="discrete"/>` +
      `<image href="${c.dataUri}" x="${left}" y="${top}" ` +
      `width="${w * frames}" height="${h}" image-rendering="pixelated"/>` +
      `</g></g>`;
  } else {
    // Still cards show frame one only — the same clip window, no stepping.
    out += `<defs><clipPath id="${clipId}">` +
      `<rect x="${left}" y="${top}" width="${w}" height="${h}"/></clipPath></defs>` +
      `<image href="${c.dataUri}" x="${left}" y="${top}" ` +
      `width="${w * frames}" height="${h}" image-rendering="pixelated" ` +
      `clip-path="url(#${clipId})"/>`;
  }
  out += `</g>`;

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

/** Stable id source — the clip window needs a unique, deterministic id. */
function hashName(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(h, 31) + s.charCodeAt(i)) | 0;
  return h;
}
