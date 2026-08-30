/** The contribution grid, drawn as ground rather than as a chart. */

export function terrain(weeks: number[], x0: number, y0: number): string {
  const max = Math.max(...weeks, 1);
  const shades = ['#1B3320', '#2A5A32', '#4E9E3A', '#7FD152'];
  let out = '';
  weeks.forEach((v, i) => {
    const lvl = v === 0 ? 0 : Math.min(3, Math.floor((v / max) * 3) + 1);
    const x = x0 + i * 16;
    for (let r = 0; r < 4; r++) {
      const jitter = (i * 7 + r * 13) % 3;
      out += `<rect x="${x}" y="${y0 + r * 10}" width="15" height="9" fill="${shades[Math.max(0, Math.min(3, lvl - (r > 1 ? 1 : 0) + (jitter === 0 ? 0 : 0)))]}" opacity="${1 - r * 0.14}"/>`;
    }
  });
  return `<g>${out}<animate attributeName="opacity" from="0" to="1" dur="0.9s" fill="freeze"/></g>`;
}

/**
 * Placeholder silhouette. Real sprites are a commission (docs/07#5).
 *
 * Light on dark with a dark outline: the first version was #1B1540 on the
 * terrain and simply vanished. A placeholder that cannot be seen is worse than
 * no placeholder -- it hides the layout problem it exists to expose.
 *
 * `y` is the ground line: the figure stands ON it rather than floating above.
 */
