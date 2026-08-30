/**
 * GitHub transport.
 *
 * Extracted from scripts/sample-percentiles.ts, where it had grown into
 * production code living in a tool: connection reuse, retry, adaptive
 * batching, and the two rate limits. The Action needs exactly this, so it
 * belongs in src/.
 *
 * Every rule here was learned by breaking:
 *   - `gh api` costs ~504 ms per call (spawn + TLS + auth). fetch is ~40 ms.
 *   - GraphQL answers 200 with `data` full of nulls and the reason in `errors`.
 *   - There are TWO 403-shaped rate limits and they need opposite responses.
 */

export class HttpError extends Error {
  constructor(readonly status: number, readonly body: string) {
    super(`HTTP ${status}: ${body.slice(0, 120)}`);
  }
}

export const sleep = (ms: number): Promise<void> =>
  new Promise((r) => setTimeout(r, ms));

/** 5xx, plus the socket failures any long run eventually meets. */
export const isTransient = (err: unknown): boolean =>
  (err instanceof HttpError && err.status >= 500) ||
  /ECONNRESET|ETIMEDOUT|EAI_AGAIN|socket hang up|fetch failed/i.test((err as Error).message ?? '');

export const isRateLimited = (err: unknown): boolean =>
  err instanceof HttpError &&
  (err.status === 429 ||
    (err.status === 403 && /rate limit|abuse detection|secondary/i.test(err.body)));

export interface ClientOptions {
  token: string;
  userAgent?: string;
  /** Cap on rate-limit waits per call, so a persistent limiter cannot wedge a run. */
  maxRateWaits?: number;
}

export class GitHubClient {
  private readonly headers: Record<string, string>;
  private readonly maxRateWaits: number;

  constructor(opts: ClientOptions) {
    this.headers = {
      authorization: `Bearer ${opts.token}`,
      accept: 'application/vnd.github+json',
      'user-agent': opts.userAgent ?? 'mainquest',
    };
    this.maxRateWaits = opts.maxRateWaits ?? 6;
  }

  /** REST. Returns null for the "nothing here" statuses, which are normal. */
  async rest(path: string): Promise<unknown> {
    const res = await fetch(`https://api.github.com${path}`, { headers: this.headers });
    // 204 empty repo, 202 stats still computing, 404 deleted.
    if (res.status === 204 || res.status === 202 || res.status === 404) return null;
    const text = await res.text();
    if (!res.ok) throw new HttpError(res.status, text);
    return JSON.parse(text) as unknown;
  }

  async graphql(body: string): Promise<unknown> {
    const res = await fetch('https://api.github.com/graphql', {
      method: 'POST',
      headers: { ...this.headers, 'content-type': 'application/json' },
      body,
    });
    const text = await res.text();
    // A GraphQL error is a 200 with `errors` — only a non-200 is transport.
    if (!res.ok) throw new HttpError(res.status, text);
    return JSON.parse(text) as unknown;
  }

  /**
   * Back off for the limit actually hit.
   *
   *   primary   — hourly budget spent (`remaining === 0`). Wait for the reset.
   *   secondary — too many concurrent. Budget is full; clears in ~a minute.
   *
   * Treating a secondary limit as primary is a 60-minute stall for a
   * 60-second problem, which is exactly what happened at concurrency 12.
   */
  private async backOff(log?: (s: string) => void): Promise<void> {
    try {
      const rl = (await this.rest('/rate_limit')) as {
        resources: { core: { reset: number; remaining: number } };
      };
      const { reset, remaining } = rl.resources.core;
      if (remaining > 0) {
        log?.('secondary rate limit — pausing 60s');
        await sleep(60_000);
        return;
      }
      const waitMs = Math.max(0, reset * 1000 - Date.now()) + 5000;
      log?.(`primary rate limit — waiting ${Math.ceil(waitMs / 60000)}m`);
      await sleep(waitMs);
    } catch {
      await sleep(60_000);
    }
  }

  /**
   * Retry transient failures; wait out rate limits; give up loudly on anything
   * else. Rate-limit waits do not consume a retry, but they ARE capped
   * separately — without that cap the loop is unbounded, and a run once wedged
   * for two hours across 43 secondary pauses with the budget untouched.
   */
  async withRetry<T>(
    label: string,
    fn: () => Promise<T>,
    tries = 5,
    log?: (s: string) => void,
  ): Promise<T | null> {
    let rateWaits = 0;
    for (let i = 0; i < tries; i++) {
      try {
        return await fn();
      } catch (err) {
        if (isRateLimited(err) && rateWaits < this.maxRateWaits) {
          rateWaits++;
          await this.backOff(log);
          i--;
          continue;
        }
        if (!isTransient(err) || i === tries - 1) {
          const msg = (err as Error).message ?? '';
          // Empty repos answer 204 with no body, surfacing as a parse failure.
          // That is the common case here, not an error worth printing.
          if (!/Unexpected end of JSON input/.test(msg)) log?.(`! ${label}: ${msg.slice(0, 120)}`);
          return null;
        }
        await sleep(2 ** i * 1000);
      }
    }
    return null;
  }
}

/** Run `fn` over `items` with a fixed-size pool. The wait is latency, not quota. */
export async function pooled<T, R>(
  items: readonly T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  const worker = async (): Promise<void> => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]!, i);
    }
  };
  await Promise.all(Array.from({ length: concurrency }, worker));
  return out;
}
