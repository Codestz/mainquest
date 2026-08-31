# MainQuest

> Turns a GitHub profile into a 16-bit JRPG status screen that lives in your README.

`main` is the branch it reads. A *main quest* is what it draws.

---

## What it is

A GitHub Action that reads your public contribution data, derives an RPG
character from it, and renders an animated SVG you embed in your profile README.

Not another contribution-graph animation. The green squares are the **terrain
the character stands on**, not the subject. The subject is what your activity
says about *how you work*: whether you review more than you commit, whether you
finish what you open, whether you work in bursts or steadily, whether you work
at weekends.

## The idea

The contribution-graph space is saturated — snake, Pac-Man, 3D cities, Game of
Life. They all read the same 52×7 grid of intensity values, so they are visually
different and informationally identical.

Meanwhile `contributionsCollection` exposes data almost nobody visualises:
reviews given, PRs merged versus opened, repositories touched for the first
time, private contribution counts.

**The thesis: the interesting signal is not how much you commit. It is the
_shape_ of your activity.**

That shape becomes a class — one of twelve, derived from ratios between eight
metrics, so it cannot be farmed by committing more. Two of those metrics
(`burst` and `weekend`) measure only *when* you work, never how much.

## Quickstart

Create `.github/workflows/mainquest.yml` in your profile repository
(`github.com/<you>/<you>`):

```yaml
name: mainquest

on:
  schedule:
    - cron: '37 4 * * *'   # odd minute on purpose: :00 is heavily contended
  workflow_dispatch:

jobs:
  card:
    runs-on: ubuntu-latest
    permissions:
      contents: write
    steps:
      - uses: actions/checkout@v4

      - uses: Codestz/mainquest@v1
        with:
          github_token: ${{ secrets.MAINQUEST_PAT }}
          username: ${{ github.repository_owner }}
          lang: en
          outputs: dist/

      - uses: stefanzweifel/git-auto-commit-action@v5
        with:
          commit_message: 'chore: update mainquest card'
          file_pattern: 'dist/*.svg'
```

Then in your README:

```markdown
<picture>
  <source media="(prefers-color-scheme: dark)"  srcset="dist/card-dark.svg">
  <source media="(prefers-color-scheme: light)" srcset="dist/card-light.svg">
  <img alt="MainQuest" src="dist/card-dark.svg">
</picture>
```

### Why a PAT and not `GITHUB_TOKEN`

`GITHUB_TOKEN`'s scope for user-level contribution queries does not return
`restrictedContributionsCount` — the count of your private work — so a card
built with it silently shows zero sealed activity.

**Use a fine-grained PAT with no repository access and no account
permissions.** That is not a shortcut: there is no permission to grant.
Contribution counts are an attribute of the authenticated identity rather than
a resource, so nothing in the fine-grained permission list maps to them, and a
token with everything set to "No access" returns them correctly. Verified
against both queries this Action makes.

If you prefer a classic token, `read:user` works — but it grants strictly more
than this needs.

Fine-grained tokens expire (one year maximum). This runs on a schedule, so when
it expires the card stops updating quietly. Set a reminder.

If most of your work is in private or SSO-protected repositories, see
[private contributions](#private-and-sso-protected-work) below.

## Outputs

| File | |
|---|---|
| `card-dark.svg` | Animated, dark |
| `card-light.svg` | Animated, light |
| `card-dark-still.svg` | No motion. Every ability listed at once |
| `card-light-still.svg` | The same, light |

Rendering is deterministic: the same profile on the same day produces
byte-identical SVGs, so a daily workflow commits nothing when nothing changed.

## Running it locally

```bash
npm install
npm run card -- --user=<login>     # -> build/cards/*.svg
npm run preview                    # 5 fixture profiles -> build/preview.html
npm run check                      # typecheck + 56 tests
```

## What the card shows

**Class** — one of twelve, from centred cosine similarity over eight metrics.
Two per anchoring metric, each pair split by a *shape* axis:

| metric | steady | irregular |
|---|---|---|
| commits | warrior | berserker |
| reviews | healer | druid *(weekends)* |
| merges | finisher | rogue |
| streak | sentinel | hermit *(weekends)* |
| repos | mage | wanderer |
| issues | tracker | necromancer |

**Rank** — `apprentice` → `archon`, inferred from reviews given versus PRs
opened and account age. Not a level: there is no grind that raises it. The
wording is deliberate — it is a rank earned *in this campaign*, never a claim
about anyone's actual seniority. Plenty of senior engineers have thin public
profiles.

**Abilities** — invented names over real metrics. Every ability carries a
`measures:` line naming the actual metric in dimmer type, so someone who
ignores the RPG framing reads only those lines and gets an ordinary stats card.
Nobody is ever forced to decode.

**Debuffs** — `lone wolf`, `revolving door`, `ivory tower`. The honest half.
Every good character sheet shows what you are bad at.

**Sigil** — a heraldic crest generated from your login: shield × tincture ×
ordinary × charge × cadency mark, 8,847,360 combinations. It is **permanent** —
derived from your login alone, so it never changes campaign to campaign. Some
crests are `burnished`, `gilded` or `shiny`; that is **luck, not merit**, in
the way a shiny Pokémon is.

## Private and SSO-protected work

If your work lives in private or SSO-protected repositories, the card can come
out nearly empty and look broken. Two things help.

**Show anonymised private activity.** On your profile, above the contribution
calendar → **Contribution settings** → **Private contributions**. This publishes
only the daily *count* — no repository names, no commit messages, nothing about
what the work was.

**The card handles it honestly.** When most of your activity is sealed, it does
not invent a class from whatever sliver happens to be public. It renders
`sealed`, keeps the full terrain (the calendar counts private days, so your
rhythm is real), shows the sealed count, and says *"rhythm known, role not"*.

## Status

**v1.0.0.** The Action works end to end: fetch, classify, render, commit.

Two things are honest about their limits, on the card and here:

- The percentile distribution is **n=165**, sampled from repository
  contributors. Enough to be meaningful, small enough that the card prints its
  own sample size.
- `merges` is real for a rendered card, but the *scale* it is scored against
  still uses PRs-opened, because the bulk sampler skips the Tier 1 search.

Also known: sprite proportions drift between classes, and cards are ~30 KB
against a 25 KB target (40 KB hard limit).

See [`CHANGELOG.md`](CHANGELOG.md).

## Licence

Code: [MIT](LICENSE).

Art is **not** MIT. The 192 heraldic charges come from
[game-icons.net](https://game-icons.net) under **CC BY 3.0**, which requires
attribution — see [`ATTRIBUTION.md`](ATTRIBUTION.md) before redistributing.
