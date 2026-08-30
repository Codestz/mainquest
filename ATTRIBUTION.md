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

Contributors whose work may end up in the table (full upstream list):

Lorc · Delapouite · John Colburn · Felbrigg · John Redman · Carl Olsen · Sbed ·
PriorBlue · Willdabeast · Viscious Speed (CC0) · Lord Berandas · Irongamer ·
HeavenlyDog · Lucas · Faithtoken · Skoll · Andy Meneely · Cathelineau ·
Kier Heyl · Aussiesim · Sparker · Zeromancer (CC0) · Rihlsul · Quoting ·
Guard13007 · DarkZaitzev · SpencerDub · GeneralAce135 · Zajkonur · Catsu ·
Starseeker · Pepijn Poolman · Pierre Leducq · Caro Asercion · SeregaCthtuf

## Contributors represented in the frozen charge table (v1, 192 icons)

CC BY requires naming the author — a blanket "icons by game-icons.net" does not
satisfy it. These are the contributors whose work is actually in
`data/charges.v1.json`:

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
Sources under consideration:

| Source | License | Notes |
|---|---|---|
| Kenney (kenney.nl) | CC0 | No attribution required. Preferred default. |
| Superdark 16×16 NPC pack (itch.io) | CC0 | Supplement to 0x72's tileset |
| 0x72 DungeonTileset II | CC0 | Excellent but heavily used — avoid |
| OpenGameArt (CC0 filter only) | CC0 | Verify per asset |

**Do not use** Liberated Pixel Cup sets — CC-BY-SA / GPL, copyleft.

**Rule:** check the LICENSE file inside each download. Tags lie.
