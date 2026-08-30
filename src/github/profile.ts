/**
 * Fetch one profile and shape it into exactly what the renderer consumes.
 *
 * This is the layer the project spent its whole life without: everything
 * downstream — normalise, derive, identity, render — is pure, and this is the
 * only place that touches the network.
 */

import { longestStreak, shapeMetrics, weeklyTotals } from '../metrics/calendar.js';
import type { RawMetrics } from '../normalise.js';
import type { GitHubClient } from './client.js';
import {
  PROFILE_QUERY, mergedPrsQuery,
  type MergedPrsResponse, type ProfileResponse,
} from './queries.js';

export interface Profile {
  login: string;
  campaign: number;
  raw: RawMetrics;
  /** 52-ish weekly totals: the terrain and the generated horizon. */
  weeks: number[];
  /** Private contributions. Surfaced, never silently ignored (docs/02). */
  restricted: number;
  accountAgeYears: number;
  prsOpened: number;
  /** 1..365. Drives the sky; identical for everyone rendering the same day. */
  campaignDay: number;
  /** False when `merges` fell back to PRs opened, so the card can say so. */
  mergesAreReal: boolean;
  /**
   * Contribution-calendar total, which INCLUDES private days. Compared against
   * `restricted` it says how much of this person the card can actually see.
   */
  calendarTotal: number;
}

export class ProfileNotFound extends Error {
  constructor(login: string) {
    super(`No such GitHub user: ${login}`);
  }
}

/** Day 1..365 of the campaign, clamped for a campaign that has not started. */
export function dayOfCampaign(campaign: number, now = new Date()): number {
  const start = Date.UTC(campaign, 0, 1);
  const day = Math.floor((now.getTime() - start) / 86_400_000) + 1;
  return Math.min(366, Math.max(1, day));
}

export async function fetchProfile(
  client: GitHubClient,
  login: string,
  campaign: number,
  opts: { now?: Date } = {},
): Promise<Profile> {
  const body = JSON.stringify({
    query: PROFILE_QUERY,
    variables: {
      login,
      from: `${campaign}-01-01T00:00:00Z`,
      to: `${campaign}-12-31T23:59:59Z`,
    },
  });

  const res = await client.withRetry(
    `profile:${login}`,
    () => client.graphql(body) as Promise<ProfileResponse>,
  );
  if (!res) throw new Error(`Could not fetch ${login} (see log above)`);

  // GraphQL answers 200 with `user: null` and the reason in `errors`, so a
  // missing account is not an exception — it is a successful response about
  // nothing. Distinguish it from a transport failure explicitly.
  const user = res.data?.user;
  if (!user) throw new ProfileNotFound(login);

  const c = user.contributionsCollection;
  const weeks = c.contributionCalendar.weeks;

  /**
   * PRs merged needs its own `search` call. If it fails — rate limit, a
   * transient — fall back to PRs opened rather than losing the whole card, and
   * flag it so the card can print the caveat instead of quietly flattering the
   * user on `close_the_loop`.
   */
  const merged = await client.withRetry(
    `merged:${login}`,
    () => client.graphql(JSON.stringify({ query: mergedPrsQuery(login, campaign) })) as Promise<MergedPrsResponse>,
  );
  const mergesAreReal = merged?.data?.search?.issueCount !== undefined;
  const merges = merged?.data?.search?.issueCount ?? c.totalPullRequestContributions;

  const shape = shapeMetrics(weeks);

  return {
    login: user.login,
    campaign,
    raw: {
      commits: c.totalCommitContributions,
      reviews: c.totalPullRequestReviewContributions,
      merges,
      streak: longestStreak(weeks),
      repos: c.totalRepositoryContributions,
      issues: c.totalIssueContributions,
      burst: shape.burst,
      weekend: shape.weekend,
    },
    weeks: weeklyTotals(weeks),
    restricted: c.restrictedContributionsCount,
    accountAgeYears:
      (Date.now() - new Date(user.createdAt).getTime()) / (365.25 * 86_400_000),
    prsOpened: c.totalPullRequestContributions,
    campaignDay: dayOfCampaign(campaign, opts.now),
    mergesAreReal,
    calendarTotal: c.contributionCalendar.totalContributions,
  };
}
