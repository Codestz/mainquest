# Questlog

> Turns a GitHub profile into a 16-bit JRPG status screen that lives in your README.

*Questlog is a placeholder name — see `docs/07-open-questions.md` before you commit to it.*

---

## What it is

A GitHub Action that reads a user's public contribution data, derives an RPG
character from it, and renders an animated SVG you embed in your profile README.

Not another contribution-graph animation. The green squares are the **terrain the
character stands on**, not the subject. The subject is what your activity says
about how you work: whether you review more than you commit, whether you finish
what you open, whether you work alone.

## What it looks like

See `examples/status-screen-mockup.svg` — open it in a browser, it animates.

Layout is a paused JRPG menu: windows floating over a world.

```
┌──────────────────────┐              ┌───────────────────────┐
│ codestz              │              │ habilidades           │
│ guerrero · veterano  │   [sprite]   │ > segunda opinión  ▪▪▫│
│ cmt ████████░░ 1.284 │              │   golpe sostenido  ▪▪▪│
│ rev █████████░   312 │              │   cerrar el círculo▪▫▫│
└──────────────────────┘              │   aguante          ▪▪▫│
   ▓▓▒▓▓▓▒▒▓▓▓▓▒▓▓▒▓▓▓▓▓▒▓▓▓▓▒▒▓▓▓▓  │ lobo solitario · debuff│
   ← contribution grid as terrain →   └───────────────────────┘
┌────────────────────────────────────────────────────────────┐
│ Restaura los PR de tus aliados antes de que se pudran.     │
│ mide: pull request reviews                                 │
│ 312 este año · rango II de III                             │
└────────────────────────────────────────────────────────────┘
```

## Quickstart (target API, not built yet)

```yaml
# .github/workflows/questlog.yml
name: questlog
on:
  schedule:
    - cron: '37 4 * * *'   # odd minute: :00 is heavily contended
  workflow_dispatch:

jobs:
  card:
    runs-on: ubuntu-latest
    permissions:
      contents: write
    steps:
      - uses: actions/checkout@v4
      - uses: <owner>/questlog@v1
        with:
          github_token: ${{ secrets.QUESTLOG_PAT }}   # PAT, read:user
          username: ${{ github.repository_owner }}
          lang: es
          outputs: dist/
      - uses: stefanzweifel/git-auto-commit-action@v5
        with:
          commit_message: 'chore: update questlog card'
```

Then in your README:

```markdown
<picture>
  <source media="(prefers-color-scheme: dark)"  srcset="dist/card-dark.svg">
  <source media="(prefers-color-scheme: light)" srcset="dist/card-light.svg">
  <img alt="Questlog" src="dist/card-dark.svg">
</picture>
```

## Outputs

| File | Purpose |
|---|---|
| `card-dark.svg` | Full animated card, dark theme |
| `card-light.svg` | Full animated card, light theme |
| `card-dark-still.svg` | No motion. All abilities listed at once |
| `card-light-still.svg` | Same, light |

## Docs

| File | What's in it |
|---|---|
| `VISION.md` | Why this exists and what it refuses to be |
| `docs/01-architecture.md` | Pipeline, caching, file layout |
| `docs/02-data-sources.md` | Exact GraphQL fields, query cost tiers, known traps |
| `docs/03-classes-and-abilities.md` | Class derivation, abilities, seniority ranks |
| `docs/04-art-direction.md` | 16-bit rules, animation budget, asset sources |
| `docs/05-i18n.md` | Three-language setup and the SVG text-fitting problem |
| `docs/06-roadmap.md` | v1 / v2 / v3 and what's explicitly cut |
| `docs/07-open-questions.md` | The hard-to-reverse decisions and their costs. Read before starting |

## License

Code: MIT (intended). Art assets: see `ATTRIBUTION.md`.
