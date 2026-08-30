/**
 * The GraphQL documents, and only those.
 *
 * Tier 0 (docs/02) carries the whole card for ~1 point against a 5,000/hour
 * budget. Tier 1 is one extra `search` for PRs actually merged, which is a
 * different number from PRs opened — the gap between them is the entire point
 * of `close_the_loop` and the `revolving_door` debuff.
 */

import type { ContributionWeek } from '../metrics/calendar.js';

/** Everything the card needs about one account, in one round trip. */
export const PROFILE_QUERY = `
query($login: String!, $from: DateTime!, $to: DateTime!) {
  rateLimit { cost remaining }
  user(login: $login) {
    login
    createdAt
    contributionsCollection(from: $from, to: $to) {
      totalCommitContributions
      totalPullRequestReviewContributions
      totalPullRequestContributions
      totalIssueContributions
      totalRepositoryContributions
      restrictedContributionsCount
      contributionCalendar {
        totalContributions
        weeks { contributionDays { contributionCount date } }
      }
    }
  }
}`;

export interface ProfileResponse {
  data?: {
    user: {
      login: string;
      createdAt: string;
      contributionsCollection: {
        totalCommitContributions: number;
        totalPullRequestReviewContributions: number;
        totalPullRequestContributions: number;
        totalIssueContributions: number;
        totalRepositoryContributions: number;
        restrictedContributionsCount: number;
        contributionCalendar: {
          totalContributions: number;
          weeks: ContributionWeek[];
        };
      };
    } | null;
  };
  errors?: Array<{ type?: string; message?: string }>;
}

/**
 * PRs actually merged in the window (docs/02 Tier 1).
 *
 * `search` aliases, so a batch of these costs 1 point — but for a single card
 * it is simply one more node in one more request.
 */
export const mergedPrsQuery = (login: string, campaign: number): string => {
  const q = `author:${login} is:pr is:merged created:${campaign}-01-01..${campaign}-12-31`;
  return `query { search(query: ${JSON.stringify(q)}, type: ISSUE, first: 0) { issueCount } }`;
};

export interface MergedPrsResponse {
  data?: { search: { issueCount: number } };
}
