"""
AI output -> real pixel art.

Diffusion models do not produce pixel art. They produce pixel-art-STYLED
illustration: a soft grid, anti-aliased edges, and hundreds of near-duplicate
colours. Dropped straight onto the card at image-rendering:pixelated that reads
as mush, which is the whole reason docs/04 warned against procedural art.

This makes it real:
  1. key out the magenta background          -> transparency
  2. crop to the sprite's actual bounding box -> consistent framing across classes
  3. downsample with NEAREST + area vote      -> a true pixel grid
  4. quantise to a fixed shared palette       -> the six sprites read as one set

Step 4 is the one that matters. Per-image quantisation gives six sprites six
palettes and the set stops looking like one game — the exact failure the
`windowChrome: 'fixed'` rule exists to prevent.
"""
import sys, pathlib, json, base64, io
from PIL import Image
from collections import Counter

TARGET_H = int(__import__('os').environ.get('TARGET_H', 40))  # sprite height in final pixels
# Chroma-key tolerance, as an L1 distance per channel (x3 for the sum).
#
# 60 was tuned against magenta backgrounds, where every sprite colour is far
# away and slop is free. It silently destroyed `tracker`: that generation came
# back on NAVY, and a forest-green ranger sits only 103 L1 from navy — inside
# 60x3=180 — so the first flood removed the background AND the character,
# leaving the tan accessories floating in space.
#
# A flat generated background varies by <10 per channel, so 22 (66 L1) clears
# real background noise with room to spare while leaving anything that is
# actually a colour alone.
KEY_TOL = 22

def key_out(im, tol=KEY_TOL, passes=2):
    """
    Remove the chroma-key background.

    Three things this has to survive, each of which broke a previous version:

    1. The key colour is SAMPLED, never hardcoded. The prompt asks for #FF00FF
       and the model returns what it likes — (254,6,133), (212,57,132),
       (224,52,147) in one batch.

    2. The key is the MODE of the border, not the mean. `tracker` came back
       with a navy frame around a magenta field; averaging those two gives a
       colour that is neither, so the flood matched nothing properly. The mode
       is the actual background even when the border holds two of them.

    3. Tolerance is ADAPTIVE, from the background's own spread. A fixed 60 ate
       `tracker`'s forest-green ranger — green sits 103 L1 from navy, inside
       60x3 — while a fixed 22 was too tight to clear a slightly dithered
       magenta. Real generated backgrounds have a mean-absolute-deviation of
       2-8, so a floor plus a multiple of the measured spread covers both
       without reaching anything that is genuinely a colour.

    Two passes, for a nested background. Not more: at four, once the frame and
    the field were gone, the next-largest flat region was the sprite's own body
    and it peeled that too.
    """
    im = im.convert('RGBA')
    w, h = im.size
    px = im.load()

    border = [(x, y) for x in range(w) for y in (0, h - 1)]
    border += [(x, y) for y in range(h) for x in (0, w - 1)]

    def sample(points):
        """Mode of the (coarsely quantised) opaque colours, plus their spread."""
        seen_cols = [px[x, y] for x, y in points if px[x, y][3] > 0]
        if not seen_cols:
            return None, 0
        bucket = Counter((c[0] // 12, c[1] // 12, c[2] // 12) for c in seen_cols)
        top = bucket.most_common(1)[0][0]
        members = [c for c in seen_cols
                   if (c[0] // 12, c[1] // 12, c[2] // 12) == top]
        centre = tuple(sum(c[i] for c in members) // len(members) for i in range(3))
        spread = sum(
            sum(abs(c[i] - centre[i]) for c in members) / len(members)
            for i in range(3))
        return centre, spread

    key, spread = sample(border)
    if key is None:
        return im

    for _ in range(passes):
        kr, kg, kb = key
        limit = max(54, int(spread * 8))
        seen = set()
        stack = list(border)
        removed = 0
        frontier = Counter()

        while stack:
            x, y = stack.pop()
            if (x, y) in seen or not (0 <= x < w and 0 <= y < h):
                continue
            seen.add((x, y))
            r, g, b, a = px[x, y]
            if a == 0:
                stack += [(x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)]
                continue
            if abs(r - kr) + abs(g - kg) + abs(b - kb) > limit:
                frontier[(r // 12, g // 12, b // 12)] += 1
                continue
            px[x, y] = (0, 0, 0, 0)
            removed += 1
            stack += [(x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)]

        if not frontier:
            break
        cand, count = frontier.most_common(1)[0]
        # Peel another ring only for a LARGE flat area — 1% of the canvas.
        # A sprite's own edge never contributes that in one quantised colour.
        if count < (w * h) // 100:
            break
        key = tuple(v * 12 + 6 for v in cand)
        spread = 6

    return im


def crop_to_sprite(im):
    bbox = im.getbbox()
    return im.crop(bbox) if bbox else im

def downsample(im, target_h):
    w, h = im.size
    scale = target_h / h
    tw = max(1, round(w * scale))
    # Box first (area average kills stray anti-alias pixels), then a hard
    # nearest pass to snap every pixel onto the grid.
    return im.resize((tw, target_h), Image.BOX).resize((tw, target_h), Image.NEAREST)

def structural_palette(images, n=6):
    """
    Colours the whole SET shares: outline, shadows, midtones, highlights.

    A single 16-colour palette across all six sprites was the first attempt and
    it flattened them — frequency-weighted quantisation is won by whatever
    colour is most common overall (blue-grey armour), so the mage's violet, the
    healer's green and the gold trim all collapsed into it. Five of six came out
    the same washed grey.

    Structure is shared; identity is not. Same split as seed-vs-data on the
    card: the parts that make the set read as one game are common, the parts
    that make one sprite ITS OWN are per-class.
    """
    c = Counter()
    for im in images:
        for r, g, b, a in im.get_flattened_data() if hasattr(im, 'get_flattened_data') else im.getdata():
            if a > 128:
                # Only near-neutrals compete for the shared slots.
                if max(r, g, b) - min(r, g, b) < 40:
                    c[(r // 24 * 24, g // 24 * 24, b // 24 * 24)] += 1
    return [rgb for rgb, _ in c.most_common(n)]


def accent_palette(im, n=6):
    """The saturated colours that make one class recognisable."""
    c = Counter()
    for r, g, b, a in im.getdata():
        if a > 128 and max(r, g, b) - min(r, g, b) >= 40:
            c[(r // 24 * 24, g // 24 * 24, b // 24 * 24)] += 1
    return [rgb for rgb, _ in c.most_common(n)]


def nearest(rgb, palette):
    r, g, b = rgb
    return min(palette, key=lambda p: (p[0]-r)**2 + (p[1]-g)**2 + (p[2]-b)**2)

def quantise(im, palette):
    out = Image.new('RGBA', im.size, (0, 0, 0, 0))
    src, dst = im.load(), out.load()
    for y in range(im.size[1]):
        for x in range(im.size[0]):
            r, g, b, a = src[x, y]
            if a > 128:
                dst[x, y] = (*nearest((r, g, b), palette), 255)
    return out

def sheet(frames):
    """
    Lay frames side by side into one image.

    A two-frame idle is animated with the clipPath trick (docs/04): both frames
    in one <image>, clipped to one frame's width, translateX stepping between
    them with calcMode="discrete". That needs a single sheet, not two files —
    and one <image> plus one <animateTransform> costs a single element against
    the 40-element budget, where two cross-fading images would cost two.

    Frames are padded to a common box so the character does not jump: the two
    generations rarely crop to exactly the same width.
    """
    w = max(f.size[0] for f in frames)
    h = max(f.size[1] for f in frames)
    out = Image.new('RGBA', (w * len(frames), h), (0, 0, 0, 0))
    for i, f in enumerate(frames):
        # Bottom-centred: the character stands on a ground line, so the FEET
        # must align between frames, not the top of the head.
        out.paste(f, (i * w + (w - f.size[0]) // 2, h - f.size[1]))
    return out, w, h


def main(paths, outdir):
    outdir = pathlib.Path(outdir); outdir.mkdir(parents=True, exist_ok=True)
    stage = []
    for p in paths:
        im = downsample(crop_to_sprite(key_out(Image.open(p))), TARGET_H)
        stage.append((pathlib.Path(p).stem, im))

    structural = structural_palette([im for _, im in stage])
    print(f"structural palette (shared): {len(structural)} colours")

    by_name = dict(stage)
    manifest = {}
    for name, im in stage:
        if name.startswith('b-'):
            continue
        palette = structural + accent_palette(im)
        q = quantise(im, palette)
        frames = [q]
        alt = by_name.get('b-' + name)
        if alt is not None:
            frames.append(quantise(alt, palette))
        img, fw, fh = sheet(frames)
        img.save(outdir / f"{name}.png")
        buf = io.BytesIO(); img.save(buf, 'PNG', optimize=True)
        b64 = base64.b64encode(buf.getvalue()).decode()
        manifest[name] = {"w": fw, "h": fh, "frames": len(frames),
                          "bytes": len(buf.getvalue()),
                          "dataUri": f"data:image/png;base64,{b64}"}
        print(f"  {name:<12} {fw:>2}x{fh:<3} x{len(frames)}  {len(buf.getvalue()):>5} B")
    (outdir / 'sprites.json').write_text(json.dumps(manifest, indent=1))
    print(f"-> {outdir}/sprites.json")

if __name__ == '__main__':
    main(sys.argv[2:], sys.argv[1])
