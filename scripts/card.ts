/**
 * Render one real GitHub profile.
 *
 *   npm run card -- --user=codestz
 *   npm run card -- --user=torvalds --campaign=2026 --out=build/cards
 *
 * The whole pipeline against live data:
 *   fetch -> normalise -> derive -> identity -> render
 *
 * Auth borrows the `gh` CLI's token, so there is no separate credential to
 * configure locally. The Action will pass one in directly.
 */

import { execFile } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { promisify } from 'node:util';
import { GitHubClient } from '../src/github/client.js';
import { fetchProfile, ProfileNotFound } from '../src/github/profile.js';
import { normalise } from '../src/normalise.js';
import { renderCard } from '../src/render/card.js';

const run = promisify(execFile);

const arg = <T extends string | number>(k: string, d: T): T => {
  const hit = process.argv.find((a) => a.startsWith(`--${k}=`));
  if (!hit) return d;
  const v = hit.split('=')[1]!;
  return (typeof d === 'number' ? Number(v) : v) as T;
};

const USER = arg('user', '');
const CAMPAIGN = arg('campaign', new Date().getUTCFullYear());
const OUT = arg('out', 'build/cards');

async function token(): Promise<string> {
  if (process.env['GITHUB_TOKEN']) return process.env['GITHUB_TOKEN'];
  const { stdout } = await run('gh', ['auth', 'token'], { encoding: 'utf8' });
  return String(stdout).trim();
}

async function main(): Promise<void> {
  if (!USER) {
    console.error('usage: npm run card -- --user=<login> [--campaign=2026] [--out=dir]');
    process.exit(1);
  }

  const client = new GitHubClient({ token: await token(), userAgent: 'questlog-card' });

  let profile;
  try {
    profile = await fetchProfile(client, USER, CAMPAIGN);
  } catch (err) {
    if (err instanceof ProfileNotFound) {
      console.error(err.message);
      process.exit(1);
    }
    throw err;
  }

  const card = renderCard({
    login: profile.login,
    campaign: profile.campaign,
    p: normalise(profile.raw),
    raw: profile.raw,
    weeks: profile.weeks,
    restricted: profile.restricted,
    accountAgeYears: profile.accountAgeYears,
    prsOpened: profile.prsOpened,
    campaignDay: profile.campaignDay,
  });

  mkdirSync(OUT, { recursive: true });
  const path = `${OUT}/${profile.login}.svg`;
  writeFileSync(path, card.svg);

  const r = profile.raw;
  console.log(`${profile.login} — ${card.klass}  (campaign ${profile.campaign}, day ${profile.campaignDay})`);
  console.log(`  commits ${r.commits} · reviews ${r.reviews} · merges ${r.merges}${profile.mergesAreReal ? '' : ' (proxied)'}`);
  console.log(`  streak ${r.streak} · repos ${r.repos} · issues ${r.issues}`);
  console.log(`  burst ${r.burst} · weekend ${r.weekend} · sealed ${profile.restricted}`);
  console.log(`  charge ${card.credit.id}  ->  ${path} (${(card.svg.length / 1024).toFixed(1)} KB)`);
}

void main();
