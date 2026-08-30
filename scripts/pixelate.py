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
MAGENTA_TOL = 60

def key_out(im, tol=MAGENTA_TOL):
    """
    Remove the chroma-key background.

    The key colour is SAMPLED from the corners, not hardcoded. The prompt asks
    for #FF00FF and the model returns whatever it feels like — measured across
    one batch: (254,6,133), (212,57,132), (224,52,147). A fixed magenta test
    matched some images and silently left an opaque pink square behind the
    others, which is exactly what shipped onto the first card.
    """
    im = im.convert('RGBA')
    w, h = im.size
    px = im.load()
    corners = [px[1, 1], px[w - 2, 1], px[1, h - 2], px[w - 2, h - 2]]
    kr, kg, kb = (sum(c[i] for c in corners) // 4 for i in range(3))

    # Flood from the border so a magenta-ish pixel INSIDE the sprite survives.
    seen = set()
    stack = [(x, y) for x in range(w) for y in (0, h - 1)]
    stack += [(x, y) for y in range(h) for x in (0, w - 1)]
    while stack:
        x, y = stack.pop()
        if (x, y) in seen or not (0 <= x < w and 0 <= y < h):
            continue
        seen.add((x, y))
        r, g, b, a = px[x, y]
        if a == 0:
            continue
        if abs(r - kr) + abs(g - kg) + abs(b - kb) > tol * 3:
            continue
        px[x, y] = (0, 0, 0, 0)
        stack += [(x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)]
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

def main(paths, outdir):
    outdir = pathlib.Path(outdir); outdir.mkdir(parents=True, exist_ok=True)
    stage = []
    for p in paths:
        im = downsample(crop_to_sprite(key_out(Image.open(p))), TARGET_H)
        stage.append((pathlib.Path(p).stem, im))

    structural = structural_palette([im for _, im in stage])
    print(f"structural palette (shared): {len(structural)} colours")

    manifest = {}
    for name, im in stage:
        palette = structural + accent_palette(im)
        q = quantise(im, palette)
        q.save(outdir / f"{name}.png")
        buf = io.BytesIO(); q.save(buf, 'PNG', optimize=True)
        b64 = base64.b64encode(buf.getvalue()).decode()
        manifest[name] = {"w": q.size[0], "h": q.size[1], "bytes": len(buf.getvalue()),
                          "dataUri": f"data:image/png;base64,{b64}"}
        print(f"  {name:<12} {q.size[0]:>2}x{q.size[1]:<3} {len(palette):>2} colours  {len(buf.getvalue()):>5} B raw -> {len(b64):>5} B base64")
    (outdir / 'sprites.json').write_text(json.dumps(manifest, indent=1))
    print(f"-> {outdir}/sprites.json")

if __name__ == '__main__':
    main(sys.argv[2:], sys.argv[1])
