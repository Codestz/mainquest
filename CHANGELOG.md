# Changelog

## Unreleased

### Added

**`lang` actually works.** It was an Action input for the whole of v1 —
documented, defaulted, validated by the layout tests — and wired to nothing:
every renderer did `import en from locales/en.json` and used it directly.

This was never just plumbing. Fifteen user-visible strings lived as literals in
the renderers, so swapping the import would have produced a Spanish card with
English standing lines. They now live in `ui`, in all three locales.

An unrecognised value renders English and logs a warning rather than failing
the run: a card is a scheduled job whose output is committed to a profile, and
halting over a typo in a workflow input replaces a working card with a red X.

`npm run card -- --user=<login> --lang=es` renders any locale locally.

### Fixed

Four defects that only a non-English render could expose:

**`title()` broke on every accent.** JavaScript's `\b` is ASCII-only, so `ñ`
and `á` read as word boundaries: `ermitaño` came out `ErmitañO` and `solitário`
came out `SolitáRio`. Now anchored on whitespace with a Unicode letter class.

**The status card's bottom-right corner was four independent absolute
placements**, each sized for English and for the assumption that only one
caveat ever fires. Two caveats joined onto one line ran 100px off an 880px
canvas — true in English too, and only invisible because
`isDegenerate('reviews')` is currently false. Spanish put the sample-size note
straight through the campaign seal. It is now one right-anchored stack that
grows upward, so any number of lines in any language lands in the same column.

**The ability card's debuff list started at a hardcoded `x=120`**, which
English `debuffs` clears and Spanish `penalizaciones` — 14 tracked characters,
120px — runs straight through. The offset is measured from the label now.

**`locales/es.json` was missing `_meta.note`.** Key parity across all three
locales is now asserted, along with no empty strings and — the one that would
have bitten quietly — that every `{placeholder}` survives translation. A locale
that drops `{n}` renders "rango de 3" and nothing else would have noticed.

### Tests

137 -> 175.

## 1.1.0

### Added

**A second card: `abilities-{dark,light}.svg`.** 880×620, no motion, all eight
abilities at once with `measures:` line, raw count, tier and percentile. The
status card has room to name four; `burst fire` and `sabbath` decide half of
every class split and had never been rendered anywhere. Selected with the new
`cards: status,abilities` input.

It is a card *kind*, not a motion variant. Filed under `motion`, a workflow
asking for `animated` would have silently lost the whole card.

Shape metrics read in their own units — `1.02×`, `48%` — not as raw counts
(`burst` is a coefficient of variation ×1000, `weekend` a per-mille share).
Percentiles print as `p93` rather than "top 7%", which becomes an insult at the
bottom of the scale.

**Class ambience.** The character now emits something belonging to its class:
five behaviours (`embers`, `sparks`, `motes`, `leaves`, `dust`) coloured per
class. Withheld from an unclassed profile, like the class name itself.

**Rank on the ground.** Concentric rings at the feet, one per rank above
apprentice — an apprentice gets none, or the ring would mean "character"
instead of rank. Gated on *not unclassed* rather than *classed*: rank comes
from public reviews and PRs, which survive a seal.

**A foreground bank and a bird flock.** The scene had a background and a middle
ground and nothing in front. The bank is derived from the same monthly totals as
the ridges, heavily flattened — one landscape at four depths. Birds ride the sky
layer so they pass behind the menu windows, and do not fly in fog or snow.

**Two-frame sprite idles.** All thirteen classes, via a clip window stepped one
frame width with `calcMode="discrete"` — one animated element per character.

### Fixed

**`tier(0)` returned 1.** A profile with no reviews lit a pip beside "second
opinion" and printed *tier 1 of 3*. An ability never used is untrained, not
tier 1. The floor keys to the raw count, not the percentile, so someone at the
bottom of the sample who *has* done the thing still gets tier 1. Invisible at
four rows; unmissable once eight were on screen at once.

**`weather('snow')` blew the animation budget.** One `<animateTransform>` per
flake — 26, atop the ~30 the rest of the card spends, against a limit of 40. No
fixture reached it: snow needs a profile that was busy and then stopped, and
every fixture is uniformly busy or uniformly empty. Now three seamlessly
scrolling fields (`render/scene/field.ts`) — more snow, three elements.

**The ability cursor cost eight elements for four rows.** Highlight and arrow
ran identical keyframes off an identical clock; they now share one `<animate>`.

### Changed

**Derivation extracted to `render/sheet.ts`.** Two cards each running their own
`classify()`, `standing()` and `rank()` is two chances to disagree — and a
status card reading "Hermit" beside an ability card reading "Sentinel" would
look fine on both. Tests assert the two agree on class and on every tier.

**`lang` documented as reserved.** It has never been wired: the renderer
imports `en` directly. The `es` and `pt-BR` files are complete and validated
against every text slot, but nothing loads them. Removed from the README
quickstart rather than left implying it works.

### Tests

56 → 137. New: the animation and byte budgets across every fixture × day ×
theme (including a synthetic went-quiet profile, the only input that reaches
the snow branch); every declared scene axis actually reaching the canvas; the
two cards agreeing; and the ability card's three text slots fitting in all
three locales.

## 1.0.1

### Fixed

**Target `node24`.** Node 20 is removed from Actions runners on 2026-09-23,
and runners already force node20 actions onto 24 with a deprecation warning.
The bundle had only ever been tested on 24. Found by a real runner, not by a
test — nothing local exercises `runs.using`.

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
mattered: a class is frozen for a whole campaign, so it would have frozen a
coin toss.

**A permanent heraldic sigil.** Shield × tincture × ordinary × charge × cadency,
8,847,360 combinations, drawn from `identitySeed(login)` so it never changes
campaign to campaign. 192 charges curated by eye at 28px from 4,239 candidates.

**Rarity as luck, never merit.** `plain` 82% / `burnished` 14% / `gilded` 3.5% /
`shiny` 0.5%. The seed is a public login — nobody earned it — so the framing is
the shiny Pokémon, and the naming is material (`gilded`, never `legendary`).

**Three standings.** `classed`, `sealed` (mostly private work: rhythm known,
role not), `unclassed` (nothing to go on). A corporate profile behind SSO renders as
`sealed`; classifying it `healer` off a single public review was worse than
rendering it empty.

**Four outputs**, dark and light, animated and still. Rendering is
deterministic, so an unchanged profile produces byte-identical SVGs.

### Known limits, stated on the card itself

- The percentile distribution is **n=165**, sampled from repository
  contributors. The card prints its own sample size.
- `merges` is real for a rendered card, but the *scale* it is scored against
  still uses PRs-opened, because the bulk sampler skips the Tier 1 search.
- Sprite proportions drift between classes.
- Cards are ~30 KB against a 25 KB target (40 KB hard limit).

### Not in 1.0

Duels, the hosted endpoint, vertical video, comment-based abilities, peak-hour
detection and diff-size abilities are all explicitly out of scope for 1.0.
