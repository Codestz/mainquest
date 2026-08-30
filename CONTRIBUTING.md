# Contributing

Thanks for looking. This document is short on ceremony and long on the two or
three things that will actually break if you do them wrong.

## Getting set up

```bash
npm install
npm run check          # typecheck + tests. Do this before anything else.
npm run preview        # renders 5 fixtures -> build/preview.html
```

To render a real profile you need a GitHub token. `gh auth token` is borrowed
automatically if you have the CLI logged in; otherwise set `GITHUB_TOKEN`.

```bash
npm run card -- --user=<login>
```

## The three rules that matter

### 1. `derive/` is pure. Keep it that way.

`src/github/profile.ts` is the only place in `src/` that touches the network.
Everything downstream — `normalise`, `derive`, `identity`, `render` — is a pure
function of its input. That is what makes the whole system testable without a
network, and what will let the same `derive()` feed a video renderer or a duel
simulation later.

If you find yourself wanting a `fetch` inside `derive/`, the answer is to pass
the data in.

### 2. Output must be byte-identical for identical input.

The Action commits its output to a user's profile repo on a schedule. If a
render is non-deterministic, every run produces a diff and the repo fills with
noise commits.

So: **no timestamps in output, no `Math.random()`, no unrounded floats.**
Randomness comes from `identity/seed.ts`, which is seeded from the login.

You can check it:

```bash
npm run card -- --user=<login> --out=/tmp/a
npm run card -- --user=<login> --out=/tmp/b
diff /tmp/a/card-dark.svg /tmp/b/card-dark.svg    # must be empty
```

### 3. Frozen tables are frozen.

`data/charges.v1.json` and the sigil tables in `src/render/sigil/tables.ts`
feed the **permanent** identity lane. `pick()` selects with
`floor(rnd() * items.length)`, so **changing a table's length redraws every
existing user's crest.** Appending one icon to a 192-entry list is not an
additive change.

Growing a table means shipping `v2` and leaving existing users on `v1`. Never
edit `v1` in place. `frozenTable()` will throw at load if a declared size and
an actual length disagree — that is the guard, please do not route around it.

## Adding a class

Classes are archetype vectors in an 8-dimensional metric space, classified by
**centred** cosine similarity. Adding one is a data change, but a consequential
one:

1. Add the vector to `ARCHETYPES` in `src/derive.ts`.
2. Add `name` and `epithet` to **all three** locales.
3. Add a sprite to `data/sprites.v2.json` (see below).
4. Re-run the separability check — a new class that sits within noise of an
   existing one makes both meaningless, and `docs/07#2` freezes a user's class
   for a whole campaign, so it would freeze a coin toss.

The bar: the closest archetype pair should stay below ~0.85 cosine, and the
population's bottom-decile win margin above ~0.01.

## Adding art

Sprites are generated and then converted to real pixel art:

```bash
GEMINI_API_KEY=... node <gen-image>/scripts/generate.mjs --prompt "..." --out build/ai/x.png
python3 scripts/pixelate.py build/ai/px build/ai/*.png
```

`scripts/pixelate.py` does the part that matters: diffusion models produce
pixel-art-*styled* illustration, not pixel art — soft grid, anti-aliased edges,
hundreds of near-duplicate colours. The pipeline chroma-keys the background
(sampling the key from the corners, because the model returns whatever magenta
it likes), crops, downsamples onto a true grid, and quantises to a **shared
structural palette plus per-class accents**.

Do not quantise each sprite to its own palette. A single shared palette was
tried first and flattened five of six sprites to the same grey; per-sprite
palettes make the set stop reading as one game. Structure is shared, identity
is not.

## Text and translation

SVG has no text wrapping. A string that overflows its window runs off the edge
**silently**, and Spanish and Portuguese run 20–30% longer than English.

`test/fit.test.ts` checks every ability name, `measures:` line, class epithet
and effect string against its slot width in all three locales. If you add or
change a string, run `npm run check` — an overflow is a failing test, not a
visual surprise later.

Flavour text is **transcreated, not translated**: ability names, class names,
epithets and debuffs get rewritten natively per language. The `measures:` lines
are the exception — those are metric names and must be translated literally and
consistently, because they are the part a reader who ignores the RPG framing
actually relies on.

## What this project refuses to be

Read `VISION.md` before proposing a feature. Briefly:

- **Not a productivity metric.** No "you were 23% more productive."
- **Not a leaderboard.** Percentiles exist to make tiers meaningful and are
  never shown as a rank against other people.
- **Debuffs stay.** The honest half is not an oversight to be smoothed away.
- **Rarity is luck, never merit.** `flourish` is a shiny: nobody thinks a shiny
  means you are good at the game. If a visual could mean either "you got lucky"
  or "you're good", the card stops being readable.

## Commits

Explain *why*, not what — the diff already says what. If you fixed something
subtle, say what it looked like when it was broken; that is the part nobody can
reconstruct later.

## Reporting a bug

Include the login it happened with if the card is public, the campaign year,
and the SVG if you have it. Rendering bugs are usually reproducible from
`npm run card -- --user=<login>` alone.
