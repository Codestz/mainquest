# data/

## percentiles.json

The distribution every tier, rank and debuff trigger reads from. Built by:

```
npm run sample                          # 4,000 accounts -> data/percentiles.json
npm run sample -- --n=6000 --min-activity=20
```

Regenerate quarterly.

### How the sample is drawn

Logins come from REST `/users?since=<random id>`, which enumerates accounts by
id — a **uniform sample over accounts ever created**. Ids are dense and the
current maximum is above 250,000,000.

`search(type:USER)` was the obvious alternative and is worse: it caps at 1,000
results per query and ranks by followers, so it returns a distribution of
prominent developers and calls it GitHub.

**Do not scrape profile pages.** One aliased GraphQL request carries 50 users at
a cost of **1 point** against a 5,000/hour budget, so a few thousand profiles is
minutes of API time, inside the terms, and returns the exact field shape
production uses.

### The activity floor — the consequential decision

A uniform sample of GitHub accounts is overwhelmingly dormant. Measured on a
pilot of 173 accounts:

| | |
|---|---|
| Any public activity in the campaign | **8.1%** |
| p50 commits among those | 3 |
| p99 commits among those | 189 |
| p50/p90/p99 reviews | 0 / 0 / 0 |

Publishing that unconditioned would put **every single person who installs this
card at p99 on every metric**, and a tier that everyone maxes tells them
nothing. The failure is silent: the table looks scientific and the card is
meaningless.

The population that matters is not "GitHub accounts". It is "people who would
put a character sheet on their profile" — who are, by definition, using GitHub
in public. So the published table is conditioned on an activity floor
(`--min-activity`, default 20 contributions in the campaign), and the file
records `minActivity`, `retainedFraction` and `anyActivityFraction` so the
conditioning is never invisible to whoever reads it.

**The rows are kept**, in two copies on purpose:

| | |
|---|---|
| `build/sample.jsonl` | Identified. Local only, gitignored. |
| `data/sample.anon.jsonl` | Same rows minus `login`. Committed. |

Percentiles need the numbers, not the people, so the published table stays
auditable and re-tunable without shipping a named dataset of 5,000 strangers'
activity to a public repo. Re-tuning the floor is a local recompute over the
committed file, not another run against someone else's API.

### What the first real sample found

5,392 accounts, campaign 2026. **`reviews` came back degenerate**: among the 219
accounts clearing the floor, 11 (5.0%) gave a single review, so p50 = p90 = 0.
A percentile over that is a boolean wearing a percentile's clothes.

That is a problem for the thesis, not a rounding error — `second_opinion` is the
flagship ability, `healer` the flagship class, and seniority rank *is*
reviews ÷ PRs. Raising the floor does not fix it and costs sample size fast:

| floor | n | reviews p90 |
|---|---|---|
| 20 | 219 | 0 |
| 100 | 90 | 0 |
| 200 | 49 | 1 |

The frame is honest but aimed at the wrong population: uniform over account ids
returns the median GitHub account, and people who review PRs are a thin slice of
it. Next frame to try is uniform over **repository** ids
(`/repositories?since=`), then those repos' contributors — the population that
actually does the behaviour.

### Not sampled here

`merges` needs one `search(type:ISSUE ... is:merged)` call **per user** (docs/02
Tier 1). Search is rate-limited separately at 30 requests/minute, so a few
thousand users is hours, not minutes. It needs its own pass.

## charges.v0.json

**Placeholder.** 50 game-icons.net paths so the renderer has something to draw.
Replace with the curated 192 from `npm run sheet` — see `docs/04-art-direction.md`.

## sprites/

Base64-inlined PNGs, one per class. See `docs/04-art-direction.md` for sourcing
and `ATTRIBUTION.md` for licensing. Remember `image-rendering="pixelated"`.
