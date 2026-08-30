# Start here

Read in this order:

1. **`VISION.md`** — why this exists, and the three things that differentiate it
   from the dozen contribution-graph toys that already have thousands of stars.
2. **`docs/07-open-questions.md`** — now `Decisions`. All closed except the
   name (#4), which only blocks Marketplace publishing. #7 is the one to read
   first: the seed-vs-data boundary is what makes the card yours.
3. **`docs/02-data-sources.md`** — what's free, what costs an extra query, and
   the two things I originally proposed that turned out to be expensive.
4. Everything else as needed.

## First three tasks, in order

1. **Build the percentile sample.** Least fun, blocks everything. Without a real
   distribution, tiers and ranks are arbitrary numbers you invented and people
   will notice within a week. Do **not** scrape — alias the GraphQL query: ~50
   `user(login:)` nodes per request at ~1 point each, so a few thousand profiles
   is minutes of API time, inside terms, and returns the exact field shape
   production uses.
2. **Build `derive()` against fixtures.** Pure function, no network. The whole
   class/rank/ability/debuff system can be correct before a single line of SVG
   or one call to the GitHub API.
3. **Build the heraldic sigil composer.** `src/identity.ts` already
   fixes the ownership boundary; the sigil is the axis that does most of the
   differentiating work. Shield × charge × ordinary × two tinctures over
   game-icons.net single paths, driven by the seeded PRNG.

## What's in this zip

| Path | |
|---|---|
| `README.md` | Public-facing readme, target usage |
| `VISION.md` | The thesis and the non-goals |
| `docs/01-07` | Architecture, data, classes, art, i18n, roadmap, open questions |
| `locales/*.json` | en / es / pt-BR, with the full ability + class + rank strings |
| `src/derive.ts` | Cosine classification, hysteresis, rank, debuffs |
| `src/identity.ts` | Per-user seed, sigil/accessory axes, `seedPolicy()` |
| `src/i18n/fit.ts` | The SVG text-overflow guard for i18n |
| `action.yml` | Action interface sketch |
| `examples/profile-workflow.yml` | What a user copies into their profile repo |
| `examples/status-screen-mockup.svg` | Open in a browser — it animates |
| `data/README.md` | Spec for the percentile table you need to build |
| `ATTRIBUTION.md` | Asset licensing, and what to avoid |

## Reminders that are easy to lose

- The name: npm `questlog` is **free**, the GitHub org is **taken**, and 535
  repos already use the name. Only Marketplace publishing is blocked by it, so
  it is safe to decide late — see `docs/07-open-questions.md#4`.
- **Scheduled workflows die after 60 days of repo inactivity.** Commit weekly
  even when nothing changed, or the Action silently stops.
- **No timestamps in the SVG output**, or every run is a diff.
- **880×420 max.** Taller pushes pinned repos below the fold.
- The `mide:` line under every ability is what makes the card readable to people
  who don't care about the RPG framing. Don't drop it for space.
