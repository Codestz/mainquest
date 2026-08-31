# Changelog

## 1.0.0

First public release.

### What it does

A GitHub Action that reads your public contribution data, derives an RPG
character from it, and renders SVG cards for your profile README.

**Two cards.** `card-{dark,light}.svg` is the scene: a character standing on a
year of contributions under a sky that tracks the campaign, with four abilities
and any debuffs. `abilities-{dark,light}.svg` is the reading copy: all eight
abilities with their `measures:` line, count and tier. Both come from one
derivation, so they cannot disagree.

**Class from shape, not volume.** Twelve classes, each a hand-authored
archetype vector, matched by centred cosine. Six volume metrics are split by
two shape metrics — `burst` and `weekend` — which are the only ones here you
cannot move by working *more*, only by working *differently*. Both are shown
on the card, so it says why it chose what it chose.

**A stable identity.** Your sigil and familiar are drawn from a permanent seed
and never change; the palette drift and campaign seal are per-year. Every
visual axis is declared `seed`, `data` or `fixed`, and the mapping fails to
compile if an axis has no owner — so ornament can never sit where it reads as
measurement.

**Class stability.** Below 100 contributions the class is provisional and
recomputed each run. Above it, the class freezes for the rest of the campaign
so your identity does not drift week to week.

**Three languages.** `en`, `es`, `pt-BR`, transcreated rather than translated.
Every string is width-checked against its slot at build time, because SVG has
no text wrapping and an overflowing translation just runs off the edge.

### What it does not do

**It does not rank you against other people.** There is no percentile on either
card. The metrics have incompatible units, so something has to map them onto
one range before they can be compared to an archetype — but that is a *scale*,
the way a game's stat curve is a scale, and the bars are levels rather than
standings.

An earlier build did print a percentile against a sample of real accounts. It
was removed rather than improved, because no sample size fixes it: there is no
neutral population to rank against. Uniform over all GitHub accounts is
overwhelmingly dormant, so any frame must condition on activity, and every such
condition is a choice. It also argued against the premise — a card that
describes *how* you work has no business printing a *how much* ranking.

**It does not flatter you.** Debuffs are computed from the same data as
everything else and render legibly. An ability you have never used is tier 0
and says so. `merges` is scored on a scale calibrated for PRs *opened*, which
flatters everyone, and the card prints that caveat on every render.

**It does not claim what it cannot see.** A profile whose work is mostly
private is `sealed`: the rhythm is shown, the class is withheld, and the sprite
stays generic rather than asserting a class the text declined to name. Running
without a PAT means private contributions cannot be read at all, and the card
says `private work not counted` rather than presenting you as idle.

### Setup

No secret required. `github_token` defaults to the workflow's own
`GITHUB_TOKEN`, which is enough for public activity; add a PAT only to have
private work counted. See the README.

### Guarantees

Rendering is deterministic — same input, byte-identical output — so an
unchanged profile produces no diff. Every card holds under 40 animated elements
and 40 KB, enforced across every fixture, day, theme and motion mode. The
committed action bundle is verified in lockstep with `src/`, and CI runs the
action as a real step on every push.
