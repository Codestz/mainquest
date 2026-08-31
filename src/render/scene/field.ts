/**
 * A seamlessly scrolling particle field.
 *
 * The naive way to make snow or embers is one `<rect>` plus one `<animate>`
 * per particle. The first snow implementation did exactly that: 26 particles,
 * 26 animated elements, against a 40-element budget the rest of the card had
 * already spent 30 of. A dormant profile would have rendered a card with 54
 * animations in it.
 *
 * The fix is the oldest trick in 2D games: draw the particles TWICE, one tile
 * apart, clip to a one-tile window, and translate by exactly one tile. When
 * the loop restarts, copy two is sitting precisely where copy one was, so the
 * jump is invisible. Any number of particles costs ONE animated element.
 *
 * Horizontal drift is the one seam this leaves: `dx` does not reset. Keep it
 * small — at |dx| <= 8 on 2px dots at low opacity, the restart is not visible.
 */

/**
 * Integer LCG rather than `Math.sin`-hashing.
 *
 * The card is required to be byte-identical for the same input, and
 * that has to hold across platforms. Integer arithmetic is exactly specified;
 * the last bits of a transcendental are not.
 */
function seeded(salt: number): () => number {
  let st = (Math.imul(salt, 2654435761) ^ 0x9e3779b9) >>> 0;
  return () => {
    st = (Math.imul(st, 1664525) + 1013904223) >>> 0;
    return st / 4294967296;
  };
}

export interface FieldSpec {
  /** The window the particles live in. Also the tile height. */
  x: number; y: number; w: number; h: number;
  count: number;
  size: number;
  colour: string;
  opacity: number;
  /** Travel per loop. Vertical travel is always exactly `h` — that is the seam. */
  dir: 'up' | 'down';
  dx: number;
  dur: number;
  begin?: number;
  salt: number;
}

/** The clip window a field needs. Emit once per id, inside <defs>. */
export const clipRect = (id: string, x: number, y: number, w: number, h: number): string =>
  `<clipPath id="${id}"><rect x="${x}" y="${y}" width="${w}" height="${h}"/></clipPath>`;

export function field(clipId: string, s: FieldSpec, animate: boolean): string {
  const rnd = seeded(s.salt);
  const cells: Array<readonly [number, number]> = [];
  for (let n = 0; n < s.count; n++) {
    cells.push([Math.round(rnd() * s.w), Math.round(rnd() * s.h)] as const);
  }

  const tile = (oy: number): string =>
    cells
      .map(([cx, cy]) =>
        `M${s.x + cx} ${s.y + cy + oy}h${s.size}v${s.size}h-${s.size}z`)
      .join('');

  // The second copy sits one tile ahead of travel, so it slides in as the
  // first slides out.
  const up = s.dir === 'up';
  const d = up ? tile(0) + tile(s.h) : tile(-s.h) + tile(0);

  let out = `<g clip-path="url(#${clipId})">` +
    `<path d="${d}" fill="${s.colour}" opacity="${s.opacity}">`;
  if (animate) {
    out += `<animateTransform attributeName="transform" type="translate" ` +
      `values="0 0;${s.dx} ${up ? -s.h : s.h}" dur="${s.dur}s"` +
      (s.begin ? ` begin="${s.begin}s"` : '') +
      ` repeatCount="indefinite"/>`;
  }
  return out + `</path></g>`;
}
