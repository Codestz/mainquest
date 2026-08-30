/**
 * Builds data/percentiles.json — the distribution every tier, rank and debuff
 * trigger reads from. Until this file is real, those are numbers we invented.
 *
 *   npm run sample -- --n=4000
 *   npm run sample -- --n=300 --out=data/percentiles.pilot.json
 *
 * Sampling frame (this is the methodological decision, not an implementation
 * detail): logins come from REST `/users?since=<random id>`, which enumerates
 * accounts by id. That is a *uniform* sample over accounts ever created.
 *
 * `search(type:USER)` was the obvious alternative and is worse: it caps at
 * 1,000 results per query and ranks by followers, so it would hand back a
 * distribution of prominent developers and call it GitHub.
 *
 * Do NOT scrape profile pages. One aliased GraphQL request carries 50 users at
 * a cost of 1 point against a 5,000/hour budget, so a few thousand profiles is
 * minutes of API time, inside the terms, and returns the exact field shape
 * production uses.
 */

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { execFile } from 'node:child_process';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { promisify } from 'node:util';

const run = promisify(execFile);
const TMP = mkdtempSync(join(tmpdir(), 'questlog-'));
process.on('exit', () => rmSync(TMP, { recursive: true, force: true }));

const arg = <T extends string | number>(k: string, d: T): T => {
  const hit = process.argv.find((a) => a.startsWith(`--${k}=`));
  if (!hit) return d;
  const v = hit.split('=')[1]!;
  return (typeof d === 'number' ? Number(v) : v) as T;
};

const N = arg('n', 4000);
const OUT = arg('out', 'data/percentiles.json');
const CAMPAIGN = arg('campaign', 2026);
/**
 * Activity floor for the published distribution. See the note on `active`
 * below -- this is the single most consequential number in the file.
 */
const MIN_ACTIVITY = arg('min-activity', 20);
/** Identified rows, kept locally so the floor can be re-tuned without refetching. */
const RAW = arg('raw', 'build/sample.jsonl');
/** The same rows minus `login` — committed as provenance for the table. */
const ANON = arg('anon', 'data/sample.anon.jsonl');
const BATCH = 50;
/** Ids are dense, so this is roughly "accounts ever created". */
const MAX_USER_ID = 250_000_000;

const FROM = `${CAMPAIGN}-01-01T00:00:00Z`;
const TO = `${CAMPAIGN}-12-31T23:59:59Z`;

type Metric = 'commits' | 'reviews' | 'streak' | 'repos' | 'issues' | 'prs';
const METRICS: Metric[] = ['commits', 'reviews', 'streak', 'repos', 'issues', 'prs'];

interface Row extends Record<Metric, number> { login: string; total: number }

/**
 * `execFile` has no `input` option -- that is `execFileSync`. Passing one is
 * silently ignored, so `gh api graphql --input -` waits on a stdin that never
 * closes and the run hangs with no output. Write the body to a temp file
 * instead and hand gh a path.
 */
const gh = async (args: string[], body?: string): Promise<unknown> => {
  let argv = args;
  let file: string | undefined;
  if (body !== undefined) {
    file = join(TMP, `q${Date.now()}${Math.random().toString(36).slice(2)}.json`);
    writeFileSync(file, body);
    argv = args.map((a) => (a === '-' ? file! : a));
  }
  try {
    const { stdout } = await run('gh', argv, { maxBuffer: 64 * 1024 * 1024, encoding: 'utf8' });
    return JSON.parse(String(stdout));
  } catch (err) {
    // A uniform id sample always contains accounts deleted or renamed between
    // sampling and fetch. GraphQL answers those with `"uN": null` alongside
    // every other user's real data and a 200 -- but `gh` still exits nonzero,
    // and execFile throws away a perfectly good partial response. Recover it.
    const out = (err as { stdout?: string }).stdout;
    if (out) {
      try { return JSON.parse(String(out)); } catch { /* genuinely broken */ }
    }
    throw err;
  } finally {
    if (file) rmSync(file, { force: true });
  }
};

/** Uniform over the id space: random offsets, one page of 100 each. */
async function sampleLogins(n: number): Promise<string[]> {
  const out = new Set<string>();
  let calls = 0;
  while (out.size < n && calls < n / 40 + 60) {
    const since = Math.floor(Math.random() * MAX_USER_ID);
    calls++;
    try {
      const page = (await gh([
        'api', `/users?since=${since}&per_page=100`,
      ])) as Array<{ login: string; type: string }>;
      for (const u of page) if (u.type === 'User') out.add(u.login);
    } catch {
      // A dead id range or a transient 5xx costs one call, not the run.
    }
    process.stderr.write(`\r  logins ${out.size}/${n}`);
  }
  process.stderr.write('\n');
  return [...out].slice(0, n);
}

const FRAGMENT = `fragment M on User {
  login createdAt
  contributionsCollection(from:$f,to:$t){
    totalCommitContributions
    totalPullRequestReviewContributions
    totalPullRequestContributions
    totalIssueContributions
    totalRepositoryContributions
    contributionCalendar{ totalContributions weeks{ contributionDays{ contributionCount } } }
  }
}`;

/** Longest run of consecutive active days — the `endurance` ability's input. */
function longestStreak(weeks: Array<{ contributionDays: Array<{ contributionCount: number }> }>): number {
  let best = 0, cur = 0;
  for (const w of weeks) {
    for (const d of w.contributionDays) {
      cur = d.contributionCount > 0 ? cur + 1 : 0;
      if (cur > best) best = cur;
    }
  }
  return best;
}

async function fetchBatch(logins: string[]): Promise<Row[]> {
  const aliases = logins
    .map((l, i) => `u${i}:user(login:${JSON.stringify(l)}){...M}`)
    .join('\n');
  const query = `query($f:DateTime!,$t:DateTime!){ rateLimit{cost remaining} ${aliases} }\n${FRAGMENT}`;
  const body = JSON.stringify({ query, variables: { f: FROM, t: TO } });

  const res = (await gh(['api', 'graphql', '--input', '-'], body)) as {
    data?: Record<string, unknown>;
  };
  const data = res.data ?? {};
  const rows: Row[] = [];
  for (const [k, v] of Object.entries(data)) {
    // A null node is a deleted or renamed account between sampling and fetch.
    if (k === 'rateLimit' || !v) continue;
    const u = v as {
      login: string;
      contributionsCollection: {
        totalCommitContributions: number;
        totalPullRequestReviewContributions: number;
        totalPullRequestContributions: number;
        totalIssueContributions: number;
        totalRepositoryContributions: number;
        contributionCalendar: { totalContributions: number; weeks: never[] };
      };
    };
    const c = u.contributionsCollection;
    rows.push({
      login: u.login,
      commits: c.totalCommitContributions,
      reviews: c.totalPullRequestReviewContributions,
      prs: c.totalPullRequestContributions,
      issues: c.totalIssueContributions,
      repos: c.totalRepositoryContributions,
      streak: longestStreak(c.contributionCalendar.weeks),
      total: c.contributionCalendar.totalContributions,
    });
  }
  return rows;
}

const STOPS = [10, 25, 50, 75, 90, 99] as const;

function percentiles(values: number[]): Record<string, number> {
  const s = [...values].sort((a, b) => a - b);
  const at = (p: number) => s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))] ?? 0;
  return Object.fromEntries(STOPS.map((p) => [`p${p}`, at(p)]));
}

async function main(): Promise<void> {
  console.error(`sampling ${N} logins uniformly over the id space…`);
  const logins = await sampleLogins(N);

  console.error(`fetching contributions for campaign ${CAMPAIGN}…`);
  const rows: Row[] = [];
  for (let i = 0; i < logins.length; i += BATCH) {
    rows.push(...(await fetchBatch(logins.slice(i, i + BATCH))));
    process.stderr.write(`\r  fetched ${rows.length}/${logins.length}`);
  }
  process.stderr.write('\n');

  // Keep the sample. Re-conditioning is a local recompute, not another
  // 80-request run against someone else's API.
  //
  // Two copies, deliberately: the identified one stays local (gitignored), and
  // the committed one drops `login`. Percentiles need the numbers, not the
  // people -- so the published table stays auditable and re-tunable without
  // shipping a named dataset of 5,000 strangers' activity to a public repo.
  mkdirSync(dirname(RAW), { recursive: true });
  writeFileSync(RAW, rows.map((r) => JSON.stringify(r)).join('\n') + '\n');

  const anon = rows.map(({ login: _login, ...rest }) => JSON.stringify(rest));
  mkdirSync(dirname(ANON), { recursive: true });
  writeFileSync(ANON, anon.join('\n') + '\n');

  /**
   * THE decision in this file.
   *
   * A uniform sample of GitHub accounts is overwhelmingly dormant -- a pilot
   * of 173 found 8% with any public activity at all, and those had a p99 of
   * 189 commits. Publishing that distribution would put every single person
   * who installs this card at p99 on every metric, and a tier that everyone
   * maxes tells them nothing.
   *
   * The population that matters is not "GitHub accounts", it is "people who
   * would put a character sheet on their profile" -- who are, by definition,
   * using GitHub in public. So the published table is conditioned on an
   * activity floor, and both the floor and the retention rate are recorded in
   * the file so the conditioning is never invisible to whoever reads it.
   */
  const active = rows.filter((r) => r.total >= MIN_ACTIVITY);

  const out = {
    generated: new Date().toISOString().slice(0, 7),
    campaign: CAMPAIGN,
    sampleSize: active.length,
    sampledAccounts: rows.length,
    minActivity: MIN_ACTIVITY,
    retainedFraction: Number((active.length / Math.max(rows.length, 1)).toFixed(4)),
    anyActivityFraction: Number((rows.filter((r) => r.total > 0).length / Math.max(rows.length, 1)).toFixed(4)),
    frame: `uniform over GitHub account ids via /users?since, conditioned on >=${MIN_ACTIVITY} public contributions in the campaign`,
    frameNote: 'The floor is deliberate. Unconditioned, a uniform account sample is ~92% dormant and would place every real user of this card at p99 on every metric.',
    caveat: 'Public activity only. `merges` is not sampled here — it needs one search call per user (see docs/02 Tier 1).',
    metrics: Object.fromEntries(
      METRICS.map((m) => [m, percentiles(active.map((r) => r[m]))]),
    ),
  };

  writeFileSync(OUT, JSON.stringify(out, null, 2) + '\n');
  console.error(`\nsampled ${rows.length} · any activity ${(out.anyActivityFraction * 100).toFixed(1)}% · >=${MIN_ACTIVITY}: ${active.length} (${(out.retainedFraction * 100).toFixed(1)}%)`);
  for (const m of METRICS) {
    const p = out.metrics[m]!;
    console.error(`  ${m.padEnd(8)} p50=${String(p['p50']).padEnd(5)} p90=${String(p['p90']).padEnd(6)} p99=${p['p99']}`);
  }
  console.error(`-> ${OUT}`);
}

void main();
