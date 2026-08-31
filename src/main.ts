/**
 * The Action entry point.
 *
 * Bundled by `ncc` into dist-action/index.js so users need no node_modules.
 * Everything it does is orchestration — fetch, resolve the campaign state,
 * render, write, report. The logic all lives in modules that never touch a
 * filesystem or a network.
 */

import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { appendFileSync } from 'node:fs';
import { join } from 'node:path';
import { GitHubClient } from './github/client.js';
import { fetchProfile, ProfileNotFound } from './github/profile.js';
import { fixtureProfile } from './fixtures.js';
import { normalise } from './normalise.js';
import { isLang, LANGS } from './i18n/locales.js';
import { renderAll } from './render/outputs.js';
import {
  parseState, resolveClass, serialiseState, type CampaignState,
} from './campaign/state.js';
import { campaignSeed, seal } from './identity/index.js';
import { rank, standing } from './derive.js';

const STATE_FILE = 'mainquest.state.json';

/** Action inputs arrive as INPUT_<NAME>, upper-cased with spaces to underscores. */
const input = (name: string, fallback = ''): string =>
  process.env[`INPUT_${name.toUpperCase().replace(/ /g, '_')}`]?.trim() || fallback;

const fail = (msg: string): never => {
  process.stdout.write(`::error::${msg}\n`);
  process.exit(1);
};

/** Set an Action output via the modern $GITHUB_OUTPUT file. */
const setOutput = (name: string, value: string): void => {
  const f = process.env['GITHUB_OUTPUT'];
  if (f) appendFileSync(f, `${name}=${value}\n`);
  else process.stdout.write(`${name}=${value}\n`);
};

async function main(): Promise<void> {
  /**
   * Render a built-in fixture instead of a real profile.
   *
   * Deliberately an environment variable and not an Action input: it is a test
   * seam, not a feature, and putting it in `action.yml` would advertise it as
   * one. CI sets it so it can run this exact bundle end to end — reading real
   * INPUT_* variables, writing real files — with no secret and no network.
   */
  const fixture = process.env['MAINQUEST_FIXTURE']?.trim();

  const token = input('github_token');
  if (!fixture && !token) {
    fail(
      'github_token is required. Use a fine-grained PAT with NO repository ' +
      'access and NO account permissions — contribution counts are an ' +
      'attribute of the authenticated identity, so there is no permission to ' +
      'grant. GITHUB_TOKEN will not work: it does not return ' +
      'restrictedContributionsCount, so private work vanishes from the card.',
    );
  }

  // A fixture carries its own login, so `username` is not merely optional in
  // fixture mode — it is ignored.
  const username = input('username', fixture ?? process.env['GITHUB_REPOSITORY_OWNER'] ?? '');
  if (!username) fail('username is required and could not be inferred.');

  const outDir = input('outputs', 'dist');
  const campaign = Number(input('campaign', String(new Date().getUTCFullYear())));
  if (!Number.isInteger(campaign)) fail(`campaign must be a year, got "${input('campaign')}"`);

  /**
   * Warn on a value that matches nothing.
   *
   * An input that selects NOTHING already fails loudly below. A PARTIAL typo
   * did not: `cards: status,abilties` rendered the status card, skipped the
   * ability card, and exited 0. That is the same failure as `lang` being wired
   * to nothing — the run is green and the output is quietly wrong — so it gets
   * the same treatment `lang` gets, a warning rather than silence.
   *
   * A warning and not a hard failure: this is a scheduled job committing to
   * someone's profile, and halting over a typo replaces a working card with a
   * red X.
   */
  const selection = (name: string, fallback: string, valid: readonly string[]): Set<string> => {
    const raw = input(name, fallback).split(',').map((s) => s.trim()).filter(Boolean);
    for (const v of raw) {
      if (!valid.includes(v)) {
        console.log(`::warning::${name}="${v}" is not one of ${valid.join(', ')}; ignoring it.`);
      }
    }
    return new Set(raw);
  };

  const wantThemes = selection('themes', 'dark,light', ['dark', 'light']);
  const wantMotion = selection('motion', 'animated,still', ['animated', 'still']);
  const wantCards = selection('cards', 'status,abilities', ['status', 'abilities']);
  /**
   * An unrecognised `lang` renders English rather than failing the run.
   *
   * This is a scheduled job whose output is committed to someone's profile.
   * Halting over a typo in a workflow input would replace a working card with
   * a red X; falling back does not. The warning is how they find out.
   */
  const langInput = input('lang', 'en').trim();
  const lang = isLang(langInput) ? langInput : undefined;
  if (!lang && langInput) {
    console.log(`::warning::lang="${langInput}" is not one of ${LANGS.join(', ')}; rendering English.`);
  }

  let profile;
  if (fixture) {
    process.stdout.write(`::notice::MAINQUEST_FIXTURE=${fixture} — rendering a fixture, not a real profile.\n`);
    try {
      profile = fixtureProfile(fixture, campaign);
    } catch (err) {
      return fail(err instanceof Error ? err.message : String(err));
    }
  } else {
    const client = new GitHubClient({ token, userAgent: 'mainquest-action' });
    try {
      profile = await fetchProfile(client, username, campaign);
    } catch (err) {
      if (err instanceof ProfileNotFound) return fail(err.message);
      throw err;
    }
  }

  // --- campaign state: read, resolve, write back -----------------------------
  const statePath = join(outDir, STATE_FILE);
  const previous: CampaignState | null = existsSync(statePath)
    ? parseState(readFileSync(statePath, 'utf8'))
    : null;

  const mark = seal(campaignSeed(profile.login, campaign));
  const rankSlug = rank(profile.raw.reviews, profile.prsOpened, profile.accountAgeYears);
  const p = normalise(profile.raw);
  /**
   * What the card is entitled to claim (the axis policy, and the `sealed` standing).
   *
   * The card already declines to name a class when the work is mostly private.
   * The Action has to agree: reporting `character_class=healer` for an account
   * that renders "sealed" is the same disagreement as drawing the berserker
   * sprite beside "unclassed" — and it is worse here, because the freeze would
   * write that invented class into the state file and hold it for a whole
   * campaign.
   */
  const state = standing(p, { sealed: profile.restricted, total: profile.calendarTotal });

  const resolved = resolveClass({
    p,
    campaign,
    totalContributions: profile.calendarTotal,
    seal: mark,
    previous,
    today: new Date().toISOString().slice(0, 10),
    // Only a classed profile may be frozen. There is nothing to freeze
    // otherwise, and an unfreezable state re-resolves cleanly every run.
    freezable: state === 'classed',
  });

  // --- render ----------------------------------------------------------------
  const all = renderAll({
    login: profile.login,
    campaign,
    p,
    raw: profile.raw,
    weeks: profile.weeks,
    restricted: profile.restricted,
    accountAgeYears: profile.accountAgeYears,
    prsOpened: profile.prsOpened,
    campaignDay: profile.campaignDay,
    calendarTotal: profile.calendarTotal,
    ...(lang ? { lang } : {}),
  });

  // `motion` gates the status card only. The ability card has no animated
  // variant to choose between, so applying the motion filter to it would let
  // `motion: animated` delete it without ever saying so.
  const selected = all.filter((o) =>
    wantThemes.has(o.theme) && wantCards.has(o.kind) &&
    (o.kind !== 'status' || wantMotion.has(o.animated ? 'animated' : 'still')));
  if (selected.length === 0) {
    fail(`No outputs selected. themes="${input('themes')}" motion="${input('motion')}" ` +
      `cards="${input('cards')}" matched nothing.`);
  }

  mkdirSync(outDir, { recursive: true });

  /**
   * Track whether anything actually changed.
   *
   * Rendering is deterministic, so an unchanged profile produces byte-identical
   * SVGs. Reporting that lets a workflow skip the commit — but see the warning
   * below before using it to skip EVERY commit.
   */
  let changed = false;
  for (const o of selected) {
    const path = join(outDir, o.file);
    const before = existsSync(path) ? readFileSync(path, 'utf8') : null;
    if (before !== o.card.svg) {
      writeFileSync(path, o.card.svg);
      changed = true;
    }
  }

  const nextState = serialiseState(resolved.next);
  const beforeState = existsSync(statePath) ? readFileSync(statePath, 'utf8') : null;
  if (beforeState !== nextState) {
    writeFileSync(statePath, nextState);
    changed = true;
  }

  // --- report ----------------------------------------------------------------
  setOutput('character_class', state === 'classed' ? resolved.klass : state);
  setOutput('rank', rankSlug);
  setOutput('changed', String(changed));

  const publicShare = profile.calendarTotal > 0
    ? (profile.calendarTotal - profile.restricted) / profile.calendarTotal : 0;

  process.stdout.write(
    `::notice::${profile.login} — ${state === 'classed' ? resolved.klass : state}` +
    `${resolved.locked ? ' (locked)' : ' (provisional)'}` +
    `, campaign ${campaign} day ${profile.campaignDay}\n`);
  process.stdout.write(
    `  commits ${profile.raw.commits} · reviews ${profile.raw.reviews} · ` +
    `merges ${profile.raw.merges}${profile.mergesAreReal ? '' : ' (proxied)'}\n` +
    `  sealed ${profile.restricted} of ${profile.calendarTotal} ` +
    `(${(100 * publicShare).toFixed(1)}% public)\n`);
  for (const o of selected) {
    process.stdout.write(`  ${join(outDir, o.file)}  ${(o.card.svg.length / 1024).toFixed(1)} KB\n`);
  }
  if (!changed) {
    /**
     * GitHub disables scheduled workflows after 60 days without repository
     * activity, and a profile repo is exactly the kind that goes quiet. Skipping
     * the commit whenever nothing changed will therefore silently kill the
     * schedule — so commit at least weekly anyway.
     * The `changed` output exists to inform that decision, not to make it.
     */
    process.stdout.write(
      '::warning::Nothing changed. Do NOT use `changed` to skip every commit: ' +
      'GitHub disables scheduled workflows after 60 days of repository ' +
      'inactivity, so a card that never commits eventually stops updating. ' +
      'Commit at least weekly regardless.\n');
  }
}

void main().catch((err: unknown) => {
  fail(err instanceof Error ? err.message : String(err));
});
