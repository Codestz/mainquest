/** The horizon IS your year: 12 monthly totals become the mountain ridge. */
import { H, W } from '../theme.js';

export function horizon(weeks: number[], y: number, colour: string): string {
  const months = Array.from({ length: 12 }, (_, m) => {
    const slice = weeks.slice(Math.floor((m * 52) / 12), Math.floor(((m + 1) * 52) / 12));
    return slice.reduce((a, b) => a + b, 0);
  });
  const max = Math.max(...months, 1);
  const pts = months.map((v, i) => {
    const x = Math.round((i / 11) * W);
    return `${x},${Math.round(y - (v / max) * 58)}`;
  });
  return `<polygon points="0,${H} ${pts.join(' ')} ${W},${H}" fill="${colour}"/>`;
}
