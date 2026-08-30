# Changelog

## 1.0.0

First release. A GitHub Action that reads a profile's public contribution data,
derives an RPG character from it, and renders four SVGs for a README.

### What it does

**Twelve classes over eight metrics.** Two per anchoring metric, each pair
split by a *shape* axis — `burst` (how spiky your activity is) and `weekend`
(what share falls on Sat/Sun). Those two cost nothing: the daily calendar was
already being fetched and discarded. They are also the only metrics here you
cannot move by committing *more*, only differently.

**Classification is centred cosine, not raw.** Percentile vectors all live in
the positive orthant, so raw cosine is inflated by a baseline every user shares
— "slightly above average at everything" and "slightly below average at
everything" sit at nearly the same angle despite being opposite people.
Measured over 165 real accounts, centring took the closest archetype pair from
0.945 to 0.786 and the bottom-decile win margin from 0.005 to 0.015. The 0.005
mattered: `docs/07#2` freezes a class for a whole campaign, and it would have
frozen a coin toss.

**A permanent heraldic sigil.** Shield × tincture × ordinary × charge × cadency,
8,847,360 combinations, drawn from `identitySeed(login)` so it never changes
campaign to campaign. 192 charges curated by eye at 28px from 4,239 candidates.

**Rarity as luck, never merit.** `plain` 82% / `burnished` 14% / `gilded` 3.5% /
`shiny` 0.5%. The seed is a public login — nobody earned it — so the framing is
the shiny Pokémon, and the naming is material (`gilded`, never `legendary`).

**Three standings.** `classed`, `sealed` (mostly private work: rhythm known,
role not), `unclassed` (nothing to go on). A corporate profile behind SSO is the
case `docs/02` predicted, and rendering it as `healer` off a single public
review was worse than rendering it empty.

**Four outputs**, dark and light, animated and still. Rendering is
deterministic, so an unchanged profile produces byte-identical SVGs.

### Known limits, stated on the card itself

- The percentile distribution is **n=165**, sampled from repository
  contributors. The card prints its own sample size.
- `merges` is real for a rendered card, but the *scale* it is scored against
  still uses PRs-opened, because the bulk sampler skips the Tier 1 search.
- Sprite proportions drift between classes.
- Cards are ~30 KB against the 25 KB target in `docs/04` (40 KB hard limit).

### Not in 1.0

Duels, the hosted endpoint, vertical video, comment-based abilities, peak-hour
detection, and diff-size abilities — all explicitly cut in `docs/06`.
