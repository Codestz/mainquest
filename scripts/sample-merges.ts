/**
 * Second pass: adds `merges` to the sampled distribution.
 *
 *   npm run sample:merges
 *
 * `totalPullRequestContributions` counts PRs **opened**, not merged, and the
 * gap between the two is the entire point of `close_the_loop` and the
 * `revolving_door` debuff (docs/02 Tier 1). Until this runs, PRs-opened stands
 * in for PRs-merged, which flatters everyone.
 *
 * docs/02 assumed one `search` call per user, and REST search is rate-limited
 * separately at 30/minute — hours for a few thousand users, which is why the
 * first pass skipped it. It turns out **search aliases**: 50 `search(type:ISSUE)`
 * nodes in one GraphQL query cost 1 point, measured. A thousand users is 20
 * requests, not a thousand.
 *
 * Reads the identified rows from the main pass, so run that first.
 */

import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { execFile } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';

const run = promisify(execFile);
const TMP = mkdtempSync(join(tmpdir(), 'questlog-merges-'));
process.on('exit', () => rmSync(TMP, { recursive: true, force: true }));

const arg = <T extends string | number>(k: string, d: T): T => {
  const hit = process.argv.find((a) => a.startsWith(`--${k}=`));
  if (!hit) return d;
  const v = hit.split('=')[1]!;
  return (typeof d === 'number' ? Number(v) : v) as T;
};

const RAW = arg('raw', 'build/sample.jsonl');
const ANON = arg('anon', 'data/sample.anon.jsonl');
const TABLE = arg('table', 'data/percentiles.json');
const CAMPAIGN = arg('campaign', 2026);
const MIN_ACTIVITY = arg('min-activity', 20);
let BATCH = arg('batch', 50);

interface Row { login: string; total: number; merges?: number; [k: string]: unknown }

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

const gh = async (args: string[], body?: string): Promise<unknown> => {
  let argv = args;
  let file: string | undefined;
  if (body !== undefined) {
    file = join(TMP, `q${Math.random().toString(36).slice(2)}.json`);
    writeFileSync(file, body);
    argv = args.map((a) => (a === '-' ? file! : a));
  }
  try {
    const { stdout } = await run('gh', argv, { maxBuffer: 64 * 1024 * 1024, encoding: 'utf8' });
    return JSON.parse(String(stdout));
  } catch (err) {
    const out = (err as { stdout?: string }).stdout;
    if (out) { try { return JSON.parse(String(out)); } catch { /* not JSON */ } }
    throw err;
  } finally {
    if (file) rmSync(file, { force: true });
  }
};

const isRateLimited = (e: unknown): boolean =>
  /API rate limit exceeded|rate limit exceeded for|secondary rate limit/i
    .test(`${(e as { stderr?: string }).stderr ?? ''}${(e as { stdout?: string }).stdout ?? ''}`);
const isTransient = (e: unknown): boolean =>
  /HTTP 50[234]|Bad Gateway|Service Unavailable|Gateway Time-?out/i
    .test(`${(e as { stderr?: string }).stderr ?? ''}${(e as { stdout?: string }).stdout ?? ''}`);

/**
 * Search has its own secondary limit that the point budget does not describe,
 * so this backs off rather than hammering.
 */
async function searchBatch(logins: string[]): Promise<Map<string, number> | null> {
  const parts = logins.map((l, i) => {
    const q = `author:${l} is:pr is:merged created:${CAMPAIGN}-01-01..${CAMPAIGN}-12-31`;
    return `s${i}: search(query:${JSON.stringify(q)}, type:ISSUE, first:0){ issueCount }`;
  });
  const body = JSON.stringify({ query: `query{ rateLimit{cost remaining} ${parts.join(' ')} }` });

  for (let attempt = 0; attempt < 6; attempt++) {
    try {
      const res = (await gh(['api', 'graphql', '--input', '-'], body)) as {
        data?: Record<string, { issueCount: number } | null>;
        errors?: Array<{ type?: string }>;
      };
      if (res.errors?.some((e) => e.type === 'RESOURCE_LIMITS_EXCEEDED')) return null;
      const out = new Map<string, number>();
      for (const [k, v] of Object.entries(res.data ?? {})) {
        if (k === 'rateLimit' || !v) continue;
        const login = logins[Number(k.slice(1))];
        if (login) out.set(login, v.issueCount);
      }
      return out;
    } catch (err) {
      if (isRateLimited(err)) { await sleep(60_000); attempt--; continue; }
      if (!isTransient(err) || attempt === 5) {
        process.stderr.write(`\n  ! ${(err as Error).message?.slice(0, 120)}\n`);
        return null;
      }
      await sleep(2 ** attempt * 1000);
    }
  }
  return null;
}

/** Same adaptive halving as the main pass: the compute ceiling is per-query. */
async function searchAdaptive(logins: string[]): Promise<Map<string, number>> {
  const got = await searchBatch(logins);
  if (got) return got;
  if (logins.length === 1) return new Map();
  const mid = Math.ceil(logins.length / 2);
  const [a, b] = [
    await searchAdaptive(logins.slice(0, mid)),
    await searchAdaptive(logins.slice(mid)),
  ];
  return new Map([...a, ...b]);
}

const STOPS = [10, 25, 50, 75, 90, 99] as const;
function percentiles(values: number[]): Record<string, number> {
  const s = [...values].sort((a, b) => a - b);
  const at = (p: number) => s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))] ?? 0;
  return Object.fromEntries(STOPS.map((p) => [`p${p}`, at(p)]));
}

async function main(): Promise<void> {
  if (!existsSync(RAW)) {
    console.error(`no identified sample at ${RAW} — run \`npm run sample\` first`);
    process.exit(1);
  }
  const rows: Row[] = readFileSync(RAW, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));

  // Only the retained rows matter: the table is conditioned on them anyway, and
  // querying dormant accounts spends the budget to learn that zero is zero.
  const targets = rows.filter((r) => r.total >= MIN_ACTIVITY);
  console.error(`merges pass · ${targets.length} retained of ${rows.length} · campaign ${CAMPAIGN}`);

  const merges = new Map<string, number>();
  for (let i = 0; i < targets.length; i += BATCH) {
    const batch = targets.slice(i, i + BATCH).map((r) => r.login);
    for (const [k, v] of await searchAdaptive(batch)) merges.set(k, v);
    process.stderr.write(`\r  searched ${merges.size}/${targets.length}`);
  }
  process.stderr.write('\n');

  for (const r of rows) r.merges = merges.get(r.login) ?? 0;
  writeFileSync(RAW, rows.map((r) => JSON.stringify(r)).join('\n') + '\n');
  writeFileSync(ANON, rows.map(({ login: _l, ...rest }) => JSON.stringify(rest)).join('\n') + '\n');

  const table = JSON.parse(readFileSync(TABLE, 'utf8')) as {
    metrics: Record<string, unknown>; caveat?: string; mergesSampled?: boolean;
  };
  const retained = rows.filter((r) => r.total >= MIN_ACTIVITY);
  table.metrics['merges'] = percentiles(retained.map((r) => r.merges ?? 0));
  table.mergesSampled = true;
  table.caveat = 'Public activity only.';
  writeFileSync(TABLE, JSON.stringify(table, null, 2) + '\n');

  const m = table.metrics['merges'] as Record<string, number>;
  const withAny = retained.filter((r) => (r.merges ?? 0) > 0).length;
  console.error(`\nmerges  p50=${m['p50']} p75=${m['p75']} p90=${m['p90']} p99=${m['p99']}`);
  console.error(`  with >=1 merged PR: ${withAny}/${retained.length} (${(100 * withAny / retained.length).toFixed(1)}%)`);
  console.error(`-> ${TABLE}`);
}

void main();
