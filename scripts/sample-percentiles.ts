/**
 * Back off correctly for the limit we actually hit.
 *
 * GitHub has TWO 403-shaped limits and they need opposite responses:
 *
 *   primary   — the hourly budget is spent (`remaining === 0`). Nothing works
 *               until the window resets, so wait it out.
 *   secondary — too many concurrent or too-rapid requests. The budget is still
 *               full; it clears in about a minute.
 *
 * Treating a secondary limit as primary is a 60-minute stall for a 60-second
 * problem — which is exactly what happened at concurrency 12: five workers each
 * parked for 61 minutes while `core` sat at 5000/5000.
 */
async function backOff(): Promise<void> {
  try {
    const rl = (await rest('/rate_limit')) as {
      resources: { core: { reset: number; remaining: number } };
    };
    const { reset, remaining } = rl.resources.core;
    if (remaining > 0) {
      process.stderr.write(`\n  secondary rate limit — pausing 60s (budget still ${remaining})\n`);
      await sleep(60_000);
      return;
    }
    const waitMs = Math.max(0, reset * 1000 - Date.now()) + 5000;
    process.stderr.write(`\n  primary rate limit — waiting ${Math.ceil(waitMs / 60000)}m for reset\n`);
    await sleep(waitMs);
  } catch {
    await sleep(60_000);
  }
}

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

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { execFile } from 'node:child_process';
import { dirname } from 'node:path';
import { promisify } from 'node:util';

const run = promisify(execFile);

/**
 * Transport.
 *
 * This used to shell out to `gh api` for every call. Measured at ~504 ms per
 * invocation — process spawn, TLS handshake, auth read — which under
 * frame=repos (~3.4 repo calls per login) is over two hours spent waiting on
 * process startup while the rate-limit budget sits almost untouched.
 *
 * Native fetch reuses the connection: ~40 ms. `gh` is still used exactly once,
 * to borrow its token, so there is no separate credential to configure.
 */
const TOKEN = (await run('gh', ['auth', 'token'], { encoding: 'utf8' })).stdout.trim();
if (!TOKEN) {
  console.error('no GitHub token — run `gh auth login`');
  process.exit(1);
}

const HEADERS: Record<string, string> = {
  authorization: `Bearer ${TOKEN}`,
  accept: 'application/vnd.github+json',
  'user-agent': 'questlog-sampler',
};

class HttpError extends Error {
  constructor(readonly status: number, readonly body: string) {
    super(`HTTP ${status}: ${body.slice(0, 120)}`);
  }
}

/** REST. Returns null for the "nothing here" statuses, which are normal here. */
async function rest(path: string): Promise<unknown> {
  const res = await fetch(`https://api.github.com${path}`, { headers: HEADERS });
  // 204 empty repo, 202 stats still computing, 404 deleted.
  if (res.status === 204 || res.status === 202 || res.status === 404) return null;
  const text = await res.text();
  if (!res.ok) throw new HttpError(res.status, text);
  return JSON.parse(text) as unknown;
}

async function graphql(body: string): Promise<unknown> {
  const res = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: { ...HEADERS, 'content-type': 'application/json' },
    body,
  });
  const text = await res.text();
  // GraphQL answers 200 with partial data and an `errors` array, so only a
  // non-200 is a transport failure worth retrying.
  if (!res.ok) throw new HttpError(res.status, text);
  return JSON.parse(text) as unknown;
}

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
/** Checkpoint of the sampled logins, so a crash mid-fetch is cheap to resume. */
const LOGINS = arg('logins', 'build/logins.txt');
const RESUME = process.argv.includes('--resume');
const BATCH = 50;
/** Ids are dense, so this is roughly "accounts ever created". */
const MAX_USER_ID = 250_000_000;
const MAX_REPO_ID = 1_000_000_000;

/**
 * Which population the table describes. This is the frame, and it decides what
 * the percentiles mean more than any other setting here.
 *
 *   users -- uniform over account ids. Honest, and aimed at the wrong
 *            population: it returns the median GitHub account, which is
 *            dormant. The first real sample came back with `reviews`
 *            degenerate (p50 = p90 = 0; 5% of retained accounts gave one).
 *
 *   repos -- uniform over repository ids, forks dropped, kept only where the
 *            repo has >=2 contributors, then those contributors. Review is a
 *            collaborative act: it cannot appear in a population of solo
 *            repos, so this samples people who are at least in a position to
 *            do it.
 *
 * `repos` is SIZE-BIASED and deliberately so: someone who contributes to ten
 * repos has ten chances to be drawn. That over-represents active developers,
 * which is the population that installs a character sheet -- but it is a bias,
 * it is not "the average developer", and the frame string records it.
 */
const FRAME = arg('frame', 'repos');
const MIN_CONTRIBUTORS = arg('min-contributors', 2);

/**
 * How many `gh` calls to keep in flight.
 *
 * The bottleneck under frame=repos is NOT the API — it is `gh` itself, measured
 * at ~504 ms per invocation (process spawn + TLS + auth), issued strictly
 * serially. At ~3.4 repo calls per login, 3,000 logins is over two hours of
 * waiting on process startup while the rate-limit budget sits untouched.
 *
 * Kept modest: GitHub's secondary rate limiter watches concurrency, and
 * withRetry already backs off if we trip it.
 */
// 12 tripped GitHub's secondary (concurrency) limiter within minutes. 6 keeps
// the ~47x win over serial `gh` without provoking it.
const CONCURRENCY = arg('concurrency', 6);

/**
 * Concurrency for the GraphQL fetch phase, kept SEPARATE from the REST one.
 *
 * REST tolerates 6 in flight. GraphQL does not: at 4 workers the secondary
 * limiter fired repeatedly and every trip cost a 60-second pause, while the
 * point budget sat at 5000/5000. Serial never tripped it. 1 is the honest
 * default; raise it only with evidence.
 */
const FETCH_CONCURRENCY = arg('fetch-concurrency', 1);

/** Seed the login set from a previous checkpoint and keep collecting. */
const SEED = process.argv.includes('--seed');

const FROM = `${CAMPAIGN}-01-01T00:00:00Z`;
const TO = `${CAMPAIGN}-12-31T23:59:59Z`;

type Metric =
  | 'commits' | 'reviews' | 'streak' | 'repos' | 'issues' | 'prs'
  // Shape, not volume. Free from the calendar we already fetch (see shapeMetrics).
  | 'burst' | 'weekend';
const METRICS: Metric[] = [
  'commits', 'reviews', 'streak', 'repos', 'issues', 'prs', 'burst', 'weekend',
];

interface Row extends Record<Metric, number> { login: string; total: number }

/**
 * `execFile` has no `input` option -- that is `execFileSync`. Passing one is
 * silently ignored, so `gh api graphql --input -` waits on a stdin that never
 * closes and the run hangs with no output. Write the body to a temp file
 * instead and hand gh a path.
 */
const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

/**
 * The PRIMARY rate limit (5,000 REST calls/hour) is not a blip to retry — it is
 * a wall to wait at. A frame=repos run costs ~4 REST calls per login, so a few
 * thousand contributors crosses it several times and a run that treats it as a
 * transient error just burns its retries and drops the batch.
 */
const isRateLimited = (err: unknown): boolean =>
  err instanceof HttpError &&
  (err.status === 429 ||
    (err.status === 403 && /rate limit|abuse detection|secondary/i.test(err.body)));

/** Sleep until the core budget resets, then carry on. */

/** 5xx, and the socket-level failures a long run inevitably meets. */
const isTransient = (err: unknown): boolean =>
  (err instanceof HttpError && err.status >= 500) ||
  /ECONNRESET|ETIMEDOUT|EAI_AGAIN|socket hang up|fetch failed/i.test((err as Error).message ?? '');

/**
 * A sampling run is minutes long and makes hundreds of calls, so it WILL meet a
 * transient failure. The first repo-frame pilot died on a single 502 after the
 * expensive REST phase had already completed, and took the whole sample with
 * it. Retry the blips; give up loudly on anything else.
 */
async function withRetry<T>(label: string, fn: () => Promise<T>, tries = 5): Promise<T | null> {
  // Not decrementing `i` on a rate-limit wait would make waiting cost a retry;
  // decrementing it WITHOUT a separate cap makes the loop unbounded. A run
  // wedged for two hours on 43 secondary pauses with the budget untouched,
  // because four workers kept re-triggering the limiter and nothing counted.
  let rateWaits = 0;
  const MAX_RATE_WAITS = 6;
  for (let i = 0; i < tries; i++) {
    try {
      return await fn();
    } catch (err) {
      if (isRateLimited(err) && rateWaits < MAX_RATE_WAITS) {
        rateWaits++;
        await backOff();
        i--; // waiting is not a failed attempt
        continue;
      }
      if (!isTransient(err) || i === tries - 1) {
        // Empty repos answer 204 with no body, which surfaces as a JSON parse
        // failure. That is the common case here, not an error worth printing.
        const msg = (err as Error).message ?? '';
        if (!/Unexpected end of JSON input/.test(msg)) {
          process.stderr.write(`\n  ! ${label}: ${msg.slice(0, 120)}\n`);
        }
        return null;
      }
      await sleep(2 ** i * 1000);
    }
  }
  return null;
}

/** Uniform over the id space: random offsets, one page of 100 each. */
async function sampleLogins(n: number): Promise<string[]> {
  const out = new Set<string>();
  let calls = 0;
  while (out.size < n && calls < n / 40 + 60) {
    const since = Math.floor(Math.random() * MAX_USER_ID);
    calls++;
    try {
      const page = (await rest(`/users?since=${since}&per_page=100`)) as Array<{ login: string; type: string }>;
      for (const u of page) if (u.type === 'User') out.add(u.login);
    } catch {
      // A dead id range or a transient 5xx costs one call, not the run.
    }
    process.stderr.write(`\r  logins ${out.size}/${n}`);
  }
  process.stderr.write('\n');
  return [...out].slice(0, n);
}

/**
 * Uniform over repo ids -> non-fork repos with real collaboration -> their
 * contributors. Costs one REST call per candidate repo, which is the price of
 * reaching a population where reviews exist at all.
 */
async function sampleViaRepos(n: number): Promise<string[]> {
  const out = new Set<string>();
  if (SEED && existsSync(LOGINS)) {
    for (const l of readFileSync(LOGINS, 'utf8').split('\n')) if (l) out.add(l);
    process.stderr.write(`  seeded ${out.size} logins from ${LOGINS}\n`);
  }
  let pages = 0, repos = 0, kept = 0, lastCheckpoint = out.size;

  const checkpoint = (): void => {
    if (out.size - lastCheckpoint < 50) return;
    lastCheckpoint = out.size;
    mkdirSync(dirname(LOGINS), { recursive: true });
    writeFileSync(LOGINS, [...out].join('\n') + '\n');
  };

  while (out.size < n && pages < n) {
    pages++;
    const page = await withRetry('repositories', () => rest(
      `/repositories?since=${Math.floor(Math.random() * MAX_REPO_ID)}&per_page=100`,
    ) as Promise<Array<{ full_name: string; fork: boolean }>>);
    if (!page) continue;

    // Forks carry their parent's contributor list and would double-count.
    const candidates = page.filter((r) => !r.fork).slice(0, 24);

    // Fixed-size pool rather than one-at-a-time: the wait is process spawn,
    // not rate limit, so overlapping calls is nearly free.
    let cursor = 0;
    const worker = async (): Promise<void> => {
      while (cursor < candidates.length && out.size < n) {
        const r = candidates[cursor++]!;
        repos++;
        // Empty repos answer 204, disabled ones 403, and stats still being
        // computed answer 202 with no body. All are skips, not failures.
        const cs = await withRetry(r.full_name, () => rest(
          `/repos/${r.full_name}/contributors?per_page=30`,
        ) as Promise<Array<{ login: string; type: string }> | null>, 2);
        if (cs && cs.length >= MIN_CONTRIBUTORS) {
          kept++;
          for (const c of cs) if (c.type === 'User') out.add(c.login);
        }
        process.stderr.write(`\r  repos ${repos} (kept ${kept}) -> logins ${out.size}/${n}`);
        checkpoint();
      }
    };
    await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  }
  writeFileSync(LOGINS, [...out].join('\n') + '\n');
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
    contributionCalendar{ totalContributions weeks{ contributionDays{ contributionCount date } } }
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

/**
 * Two SHAPE metrics, computed from the daily calendar we already fetch and
 * previously threw away after taking the streak.
 *
 * They cost nothing — same query, same point — and they are orthogonal to
 * every existing dimension, which is what 12 classes needs. Six volume-ish
 * metrics could not separate 12 archetypes: the closest pair sat at 0.980
 * cosine and the bottom decile of users won their class by 0.006, which is
 * noise a single commit would flip.
 *
 * They are also unfarmable in the way that matters. You cannot become bursty
 * or a weekend contributor by committing MORE — only by committing
 * differently. That is the project's thesis in a metric.
 */
function shapeMetrics(
  weeks: Array<{ contributionDays: Array<{ contributionCount: number; date?: string }> }>,
): { burst: number; weekend: number } {
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

  // Burstiness: coefficient of variation over ACTIVE days only. Counting
  // empty days would just re-measure volume, which we already have.
  const mean = active.reduce((s, d) => s + d.n, 0) / active.length;
  const variance = active.reduce((s, d) => s + (d.n - mean) ** 2, 0) / active.length;
  const burst = mean > 0 ? Math.round((Math.sqrt(variance) / mean) * 1000) : 0;

  const wkndTotal = active.filter((d) => d.dow === 0 || d.dow === 6)
    .reduce((s, d) => s + d.n, 0);
  const allTotal = active.reduce((s, d) => s + d.n, 0);
  const weekend = allTotal > 0 ? Math.round((wkndTotal / allTotal) * 1000) : 0;

  return { burst, weekend };
}

interface BatchResult { rows: Row[]; overLimit: boolean }

async function fetchBatch(logins: string[]): Promise<BatchResult> {
  const aliases = logins
    .map((l, i) => `u${i}:user(login:${JSON.stringify(l)}){...M}`)
    .join('\n');
  const query = `query($f:DateTime!,$t:DateTime!){ rateLimit{cost remaining} ${aliases} }\n${FRAGMENT}`;
  const body = JSON.stringify({ query, variables: { f: FROM, t: TO } });

  const res = (await graphql(body)) as {
    data?: Record<string, unknown>;
    errors?: Array<{ type?: string; message?: string }>;
  };

  /**
   * GraphQL answers 200 with `data` full of nulls and the reason in `errors`.
   * Reading `res.data` alone turns a total failure into an empty array and a
   * clean exit — which is exactly what happened: a 250-login run reported
   * success having fetched nothing.
   */
  const errors = res.errors ?? [];
  const overLimit = errors.some((e) => e.type === 'RESOURCE_LIMITS_EXCEEDED');
  const other = errors.filter(
    (e) => e.type !== 'RESOURCE_LIMITS_EXCEEDED' && !/Could not resolve to a User/.test(e.message ?? ''),
  );
  if (other.length) {
    process.stderr.write(`\n  ! graphql: ${other[0]!.type ?? ''} ${other[0]!.message?.slice(0, 100)}\n`);
  }

  const data = res.data ?? {};
  const rows: Row[] = [];
  for (const [k, v] of Object.entries(data)) {
    // A null node is a deleted or renamed account, or a field the resource
    // limit refused to compute.
    if (k === 'rateLimit' || !v) continue;
    const u = v as {
      login: string;
      contributionsCollection: {
        totalCommitContributions: number;
        totalPullRequestReviewContributions: number;
        totalPullRequestContributions: number;
        totalIssueContributions: number;
        totalRepositoryContributions: number;
        contributionCalendar: {
          totalContributions: number;
          weeks: Array<{ contributionDays: Array<{ contributionCount: number; date: string }> }>;
        };
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
      ...shapeMetrics(c.contributionCalendar.weeks),
      total: c.contributionCalendar.totalContributions,
    });
  }
  return { rows, overLimit };
}

/**
 * GitHub enforces a per-query COMPUTE ceiling (RESOURCE_LIMITS_EXCEEDED)
 * separate from the 5,000-point budget, and it depends on how active the users
 * in the batch are — not on how many there are. A batch of 50 dormant accounts
 * is fine; 50 real contributors is refused outright, every node null.
 *
 * That is why the first frame appeared to work at batch=50: it was sampling
 * dormant accounts. Nothing about the query changed, only the population.
 *
 * So the batch size cannot be a constant. Halve on refusal and recurse; a
 * single user that still cannot be computed is dropped rather than retried
 * forever.
 */
async function fetchAdaptive(logins: string[], depth = 0): Promise<Row[]> {
  const got = await withRetry(`batch[${logins.length}]`, () => fetchBatch(logins));
  if (!got) return [];
  if (!got.overLimit) return got.rows;
  if (logins.length === 1) {
    process.stderr.write(`\n  ! ${logins[0]} exceeds the per-query limit alone; dropped\n`);
    return [];
  }
  const mid = Math.ceil(logins.length / 2);
  process.stderr.write(`\r  over limit at ${logins.length}, splitting${' '.repeat(20)}`);
  return [
    ...(await fetchAdaptive(logins.slice(0, mid), depth + 1)),
    ...(await fetchAdaptive(logins.slice(mid), depth + 1)),
  ];
}

const STOPS = [10, 25, 50, 75, 90, 99] as const;

function percentiles(values: number[]): Record<string, number> {
  const s = [...values].sort((a, b) => a - b);
  const at = (p: number) => s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))] ?? 0;
  return Object.fromEntries(STOPS.map((p) => [`p${p}`, at(p)]));
}

async function main(): Promise<void> {
  let logins: string[];
  if (RESUME && existsSync(LOGINS)) {
    logins = readFileSync(LOGINS, 'utf8').split('\n').filter(Boolean);
    console.error(`resuming from ${LOGINS} (${logins.length} logins)`);
  } else {
    console.error(`sampling ${N} logins · frame=${FRAME}`);
    logins = FRAME === 'repos' ? await sampleViaRepos(N) : await sampleLogins(N);
  }

  // Checkpoint before the fetch phase. Collecting logins under frame=repos
  // costs one REST call per candidate repo — by far the expensive half — and a
  // crash during fetch must not send you back for it.
  mkdirSync(dirname(LOGINS), { recursive: true });
  writeFileSync(LOGINS, logins.join('\n') + '\n');
  console.error(`  logins checkpointed -> ${LOGINS}`);

  console.error(`fetching contributions for campaign ${CAMPAIGN}…`);
  const rows: Row[] = [];
  let skipped = 0;

  // Batches in flight. NOT more than a couple: GraphQL's secondary limiter
  // watches concurrency, and each trip costs a 60-second pause. At 4 workers a
  // 2,447-login run spent all its time parked — the serial version never
  // tripped it once. The GraphQL point budget is irrelevant here (a 50-user
  // batch costs 1 of 5,000); the only real limit is how many requests overlap.
  const batches: string[][] = [];
  for (let i = 0; i < logins.length; i += BATCH) batches.push(logins.slice(i, i + BATCH));

  let next = 0;
  const worker = async (): Promise<void> => {
    while (next < batches.length) {
      const batch = batches[next++]!;
      const got = await fetchAdaptive(batch);
      rows.push(...got);
      skipped += batch.length - got.length;
      process.stderr.write(`\r  fetched ${rows.length}/${logins.length}${skipped ? ` (dropped ${skipped})` : ''}`);
    }
  };
  await Promise.all(Array.from({ length: FETCH_CONCURRENCY }, worker));

  if (rows.length === 0) {
    console.error('\nno rows fetched — refusing to write a distribution from nothing');
    process.exit(1);
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
    frameId: FRAME,
    frame: FRAME === 'repos'
      ? `uniform over GitHub repository ids via /repositories?since, forks dropped, repos with >=${MIN_CONTRIBUTORS} contributors kept, then those contributors; conditioned on >=${MIN_ACTIVITY} public contributions in the campaign`
      : `uniform over GitHub account ids via /users?since, conditioned on >=${MIN_ACTIVITY} public contributions in the campaign`,
    /**
     * Where the table stops being trustworthy.
     *
     * The top stop is driven by a handful of bot-like accounts — in this sample
     * commits p99 = 5,879 against p90 = 510. Interpolating to p99 would
     * compress every real user into a sliver of the scale, so the table
     * declares its own clamp and `percentileOf` saturates there. It is data,
     * not a constant, so a larger sample can move it without a code change.
     *
     * This was hand-added to an earlier table and NOT emitted here, so the next
     * regeneration silently dropped it and the guard test caught the change.
     */
    tailClampedAt: 'p90',
    frameNote: FRAME === 'repos'
      ? 'Size-biased on purpose: contributing to more repos means more chances to be drawn. This over-represents active developers, which is the population that installs a character sheet — but it is a bias, and this is not "the average developer".'
      : 'The floor is deliberate. Unconditioned, a uniform account sample is ~90% dormant and would place every real user of this card at p99 on every metric.',
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
