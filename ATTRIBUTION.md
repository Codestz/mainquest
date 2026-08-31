# Attribution

## How attribution travels

CC BY 3.0 §4(b) requires attribution "reasonable to the medium or means You are
utilizing". A rendered card is embedded in READMEs across the internet **on its
own**, so a NOTICE file left in this repository does not travel with it and
does not satisfy the licence for that copy.

Every rendered SVG therefore carries its own `<metadata>` block naming the
charge, its author, game-icons.net, the licence and its URI, and stating that
the work was adapted (recoloured and composited into a sigil). That is the
medium's own mechanism for this and costs ~200 bytes.

This file remains the repository-level notice and the full contributor list.

## Icons

[game-icons.net](https://game-icons.net) — **CC BY 3.0**, attribution required
(a few contributors release CC0; the upstream `license.txt` marks which).

Source: `github.com/game-icons/icons`, 4,239 icons across 36 contributors. Each
file is a single 512×512 path once the black background rect is stripped, which
is why they inline at ~zero cost and recolour with `fill`.

Attribution is **per icon, by contributor**, and the contributor is the
directory name — `lorc/dragon-head.svg` is Lorc's. Since the charge table is a
frozen list of ~192 of them, the credit list is generated from that selection,
not maintained by hand:

```
npm run sheet          # screen candidates -> selection JSON
                       # selection JSON -> data/charges.v1.json -> credits below
```

## Contributors represented in the frozen charge table (v1, 192 icons)

CC BY requires naming the author — a blanket "icons by game-icons.net" does not
satisfy it. The charge table is frozen, so this list is exhaustive rather than
provisional: these are the only upstream contributors whose work is in
`data/charges.v1.json`.

| Contributor | Icons |
|---|---|
| lorc | 105 |
| delapouite | 65 |
| caro-asercion | 11 |
| darkzaitzev | 2 |
| skoll | 2 |
| faithtoken | 2 |
| carl-olsen | 2 |
| sparker | 1 |
| sbed | 1 |
| willdabeast | 1 |

Upstream URLs are in `license.txt` of the game-icons repository. Regenerate this
table whenever the charge table version changes.

## Sprites

**No third-party sprite assets are used.** Nothing in this section requires
attribution to anyone outside this project.

The thirteen class sprites and eight familiars in `data/sprites.v3.json` were
generated for this project with an image model and then processed into real
pixel art by `scripts/pixelate.py`:

1. key out the magenta background → transparency
2. crop to the sprite's bounding box → consistent framing across classes
3. downsample with NEAREST + area vote → a true pixel grid
4. quantise to one fixed shared palette → the set reads as one game

Step 4 is the load-bearing one. Per-image quantisation gives thirteen sprites
thirteen palettes, and the set stops looking like a single game.

They ship as base64 PNG data URIs inside the JSON, because an SVG loaded
through an `<img>` tag cannot fetch anything external.

### If you swap them

Should hand-drawn or third-party sprites ever replace these, the licence of the
replacement goes here **and** into the rendered SVG's `<metadata>` block — a
notice in this file does not travel with a card embedded in someone else's
README. See *How attribution travels* above.

Two rules that were established while sourcing candidates and still apply:

- **Do not use Liberated Pixel Cup sets** — CC-BY-SA / GPL, copyleft.
- **Check the LICENSE file inside each download.** Tags lie.
