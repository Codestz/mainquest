/**
 * Everything derived from the contribution calendar.
 *
 * The calendar is the richest thing in the Tier 0 query and the easiest to
 * waste: it carries a full year of daily counts for the same 1 point as the
 * scalar totals. `streak` was the only thing taken from it originally; `burst`
 * and `weekend` are the shape metrics that made 12 classes separable, and they
 * cost nothing extra.
 *
 * Lives in src/ rather than the sampler because the Action needs the identical
 * computation — a card whose burst is calculated differently from the
 * distribution it is scored against would be silently wrong.
 */

export interface ContributionDay {
  contributionCount: number;
  /** ISO date. Absent in some fixtures; the weekday then falls back to index. */
  date?: string;
}

export interface ContributionWeek {
  contributionDays: ContributionDay[];
}

/** Longest run of consecutive active days — the `endurance` ability's input. */
export function longestStreak(weeks: readonly ContributionWeek[]): number {
  let best = 0, cur = 0;
  for (const w of weeks) {
    for (const d of w.contributionDays) {
      cur = d.contributionCount > 0 ? cur + 1 : 0;
      if (cur > best) best = cur;
    }
  }
  return best;
}

export interface ShapeMetrics {
  /** Coefficient of variation over active days, x1000. Spiky vs steady. */
  burst: number;
  /** Share of activity falling on Sat/Sun, x1000. */
  weekend: number;
}

/**
 * The two SHAPE metrics.
 *
 * Both are scaled by 1000 and rounded so the sampled distribution stores
 * integers, matching every other metric in the table.
 *
 * Neither can be moved by committing MORE — only by committing differently.
 * That is what makes them orthogonal to the six volume-ish dimensions, and it
 * is why 12 archetypes separate in 8-D where they collapsed in 6-D.
 */
export function shapeMetrics(weeks: readonly ContributionWeek[]): ShapeMetrics {
  const days: Array<{ n: number; dow: number }> = [];
  for (const w of weeks) {
    w.contributionDays.forEach((d, i) => {
      // The calendar always runs Sunday-first, so the index IS the weekday
      // when `date` is absent.
      days.push({ n: d.contributionCount, dow: d.date ? new Date(d.date).getUTCDay() : i });
    });
  }

  const active = days.filter((d) => d.n > 0);
  if (active.length === 0) return { burst: 0, weekend: 0 };

  // Over ACTIVE days only. Including empty days would re-measure volume, which
  // the table already has twice over.
  const mean = active.reduce((s, d) => s + d.n, 0) / active.length;
  const variance = active.reduce((s, d) => s + (d.n - mean) ** 2, 0) / active.length;
  const burst = mean > 0 ? Math.round((Math.sqrt(variance) / mean) * 1000) : 0;

  const total = active.reduce((s, d) => s + d.n, 0);
  const onWeekend = active
    .filter((d) => d.dow === 0 || d.dow === 6)
    .reduce((s, d) => s + d.n, 0);

  return { burst, weekend: total > 0 ? Math.round((onWeekend / total) * 1000) : 0 };
}

/** Weekly totals, for the terrain and the generated horizon. */
export function weeklyTotals(weeks: readonly ContributionWeek[]): number[] {
  return weeks.map((w) => w.contributionDays.reduce((s, d) => s + d.contributionCount, 0));
}
