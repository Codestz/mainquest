# data/

## percentiles.json — DOES NOT EXIST YET. Build this first.

Tiers and ranks are meaningless without a real distribution. On day one you have
no users, so scrape a sample of a few thousand public profiles once, compute the
distribution of each of the six metrics, and commit the result here.

Shape:

```json
{
  "generated": "2026-Q3",
  "sampleSize": 4000,
  "metrics": {
    "commits":  { "p10": 12, "p25": 48, "p50": 180, "p75": 520, "p90": 1240, "p99": 4800 },
    "reviews":  { "p10": 0,  "p25": 3,  "p50": 21,  "p75": 96,  "p90": 310,  "p99": 1400 },
    "merges":   { "...": 0 },
    "streak":   { "...": 0 },
    "repos":    { "...": 0 },
    "issues":   { "...": 0 }
  }
}
```

Regenerate quarterly. Every downstream decision — class thresholds, rank ladder,
debuff triggers — depends on this file.

## sprites/

Base64-inlined PNGs, one per class. See `docs/04-art-direction.md` for sourcing
and `ATTRIBUTION.md` for licensing. Remember `image-rendering="pixelated"`.
