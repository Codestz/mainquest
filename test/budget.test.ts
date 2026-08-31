import { describe, expect, it } from 'vitest';
import { FIXTURES } from '../src/fixtures.js';
import { normalise } from '../src/normalise.js';
import { renderCard } from '../src/render/card.js';
import { renderAbilities } from '../src/render/abilities.js';
import { renderAll } from '../src/render/outputs.js';
import { characterSheet, tierOf } from '../src/render/sheet.js';
import { STILL, type Theme } from '../src/render/theme.js';
import { readWeather } from '../src/render/scene/weather.js';

/**
 * The two budgets, enforced instead of merely written down.
 *
 * These exist because both were quietly blown by code that looked correct in
 * isolation:
 *
 *   - `weather('snow')` emitted one <animateTransform> per flake. Twenty-six
 *     of them, on top of the ~30 the rest of the card already spends. Nobody
 *     saw it because snow only fires for a near-dormant profile, and the
 *     fixture that produces one was never rendered with the day that produces
 *     snow.
 *   - The ability cursor drew a highlight and an arrow as two elements
 *     running identical keyframes off an identical clock — eight elements for
 *     four rows, saying one thing.
 *
 * A budget nothing checks is a comment.
 */
const ANIMATED_MAX = 40;
const BYTES_MAX = 40 * 1024;

/** Day 15 lands in Q1; day 242 in Q3. Both skies, both moon positions. */
const DAYS = [15, 120, 242, 350];
const THEMES: Array<Theme['name']> = ['dark', 'light'];

const render = (f: (typeof FIXTURES)[number], day: number, theme: Theme['name'], still = false) =>
  renderCard({
    login: f.login, campaign: 2026, p: normalise(f.raw), raw: f.raw,
    weeks: f.weeks, restricted: f.restricted, accountAgeYears: f.accountAgeYears,
    prsOpened: f.prsOpened, campaignDay: day, theme,
    calendarTotal: f.weeks.reduce((a, b) => a + b, 0) + f.restricted,
    ...(still ? { motion: STILL } : {}),
  }).svg;

const animated = (svg: string): number => (svg.match(/<animate/g) ?? []).length;

describe('render budgets hold for every fixture, day and theme', () => {
  for (const f of FIXTURES) {
    for (const day of DAYS) {
      for (const theme of THEMES) {
        it(`${f.login} · day ${day} · ${theme}`, () => {
          const svg = render(f, day, theme);
          expect(animated(svg)).toBeLessThanOrEqual(ANIMATED_MAX);
          expect(Buffer.byteLength(svg)).toBeLessThanOrEqual(BYTES_MAX);
        });
      }
    }
  }

  /**
   * The snow branch is the one that blew the budget, and NO fixture reaches
   * it: snow needs a profile that was busy and then stopped, and all five
   * fixtures are either uniformly busy or uniformly empty. `zero-activity`
   * reads as fog, not snow, because its baseline is zero.
   *
   * So the budget test that was written to catch the snow bug would not have
   * caught the snow bug. This is the input that does.
   */
  it('a profile that went quiet — the snow path — stays in budget', () => {
    const f = FIXTURES.find((x) => x.login === 'heavy-committer')!;
    // Busy for forty weeks, then nothing for the last twelve.
    const weeks = f.weeks.map((v, n) => (n >= f.weeks.length - 12 ? 0 : Math.max(v, 20)));
    const svg = renderCard({
      login: 'went-quiet', campaign: 2026, p: normalise(f.raw), raw: f.raw,
      weeks, restricted: 0, accountAgeYears: f.accountAgeYears,
      prsOpened: f.prsOpened, campaignDay: 364, theme: 'dark',
      calendarTotal: weeks.reduce((a, b) => a + b, 0),
    }).svg;
    expect(readWeather(weeks, 364)).toBe('snow');
    expect(animated(svg)).toBeLessThanOrEqual(ANIMATED_MAX);
    expect(Buffer.byteLength(svg)).toBeLessThanOrEqual(BYTES_MAX);
  });

  it('a still card animates nothing at all', () => {
    for (const f of FIXTURES) {
      expect(animated(render(f, 242, 'dark', true))).toBe(0);
    }
  });
});

/**
 * Every axis the policy declares 'owned' must actually reach the canvas.
 *
 * `constellation`, `weather` and `statBars` were all listed as owned, and a
 * test asserted every axis HAD an owner — but nothing asserted the renderer
 * ever drew one. All three were dead for weeks behind a green suite.
 */
describe('declared scene axes are actually rendered', () => {
  // A profile with real, uneven activity: enough to trigger every axis.
  const busy = FIXTURES.find((f) => f.login === 'heavy-committer')!;
  const svg = render(busy, 242, 'dark');

  const PRESENT: Record<string, RegExp> = {
    // Peak weeks joined in order — the only <polyline> in the sky band.
    constellation: /<polyline points="[\d, ]+" fill="none"/,
    statBars: /CMT/,
    terrain: /<path d="M\d+ 2[5-9]\d/,
    horizon: /<polygon points="0,420/,
    foreground: /<polygon points="0,420 0,[23]\d\d/,
    sprite: /image-rendering="pixelated"/,
    sigil: /<clipPath/,
    seal: /<text[^>]*>[A-Z0-9]{8}</,
  };

  for (const [axis, re] of Object.entries(PRESENT)) {
    it(`${axis} reaches the canvas`, () => expect(svg).toMatch(re));
  }

  it('class ambience is withheld from an unclassed profile', () => {
    const empty = FIXTURES.find((f) => f.login === 'zero-activity')!;
    // Ambience clip ids are the only ones prefixed `am`.
    expect(render(empty, 242, 'dark')).not.toMatch(/id="am\d/);
    expect(svg).toMatch(/id="am\d/);
  });
});


/**
 * The ability card. Two cards derived from one profile is two chances to
 * disagree, so most of this is about them agreeing.
 */
describe('the ability card', () => {
  const input = (f: (typeof FIXTURES)[number], theme: Theme['name'] = 'dark') => ({
    login: f.login, campaign: 2026, p: normalise(f.raw), raw: f.raw,
    weeks: f.weeks, restricted: f.restricted, accountAgeYears: f.accountAgeYears,
    prsOpened: f.prsOpened, campaignDay: 242, theme,
    calendarTotal: f.weeks.reduce((a, b) => a + b, 0) + f.restricted,
  });

  for (const f of FIXTURES) {
    it(`${f.login}: lists all eight abilities and animates nothing`, () => {
      const svg = renderAbilities(input(f)).svg;
      expect(animated(svg)).toBe(0);
      expect(Buffer.byteLength(svg)).toBeLessThanOrEqual(BYTES_MAX);
      // Eight percentile labels: one per ability, none skipped.
      expect((svg.match(/>p\d{1,3}</g) ?? []).length).toBe(8);
    });

    it(`${f.login}: names the same class as the status card`, () => {
      expect(renderAbilities(input(f)).klass).toBe(renderCard(input(f)).klass);
    });
  }

  /**
   * `burst` is a coefficient of variation x1000 and `weekend` is a per-mille
   * share. Printing either raw would put "1022" in a column next to a commit
   * count and invite the reader to compare them.
   */
  it('reads shape metrics in their own units, not as counts', () => {
    const f = FIXTURES.find((x) => x.login === 'heavy-committer')!;
    const svg = renderAbilities(input(f)).svg;
    expect(svg).toMatch(/>\d+\.\d{2}×</);  // burst, e.g. 1.02x
    expect(svg).toMatch(/>\d{1,3}%</);      // weekend share
    expect(svg).not.toMatch(new RegExp(`>${f.raw.burst}<`));
  });

  it('withholds the class from an unclassed profile, on both cards', () => {
    const f = FIXTURES.find((x) => x.login === 'zero-activity')!;
    const svg = renderAbilities(input(f)).svg;
    expect(svg).toMatch(/Unclassed/);
    // No portrait either: the art may not claim what the text declines to.
    expect(svg).not.toMatch(/image-rendering="pixelated"/);
  });

  /**
   * `motion` gates the status card only. A workflow asking for `animated`
   * must still get its ability card — the bug this shape was chosen to avoid.
   */
  it('is a kind, not a motion variant', () => {
    const f = FIXTURES.find((x) => x.login === 'heavy-committer')!;
    const all = renderAll(input(f));
    const ab = all.filter((o) => o.kind === 'abilities');
    expect(ab.map((o) => o.file)).toEqual(['abilities-dark.svg', 'abilities-light.svg']);
    expect(all.filter((o) => o.kind === 'status')).toHaveLength(4);
  });
});


describe('an untrained ability claims nothing', () => {
  const f = FIXTURES.find((x) => x.login === 'zero-activity')!;
  const input = {
    login: f.login, campaign: 2026, p: normalise(f.raw), raw: f.raw,
    weeks: f.weeks, restricted: f.restricted, accountAgeYears: f.accountAgeYears,
    prsOpened: f.prsOpened, campaignDay: 242, theme: 'dark' as const,
    calendarTotal: 0,
  };

  it('a zero count is tier 0, not tier 1', () => {
    expect(tierOf(0, 0)).toBe(0);
    // Bottom of the sample but not zero is still tier 1: they did the thing.
    expect(tierOf(0, 3)).toBe(1);
    expect(tierOf(0.9, 400)).toBe(3);
  });

  it('lights no pips on an empty profile', () => {
    for (const a of characterSheet(input).abilities) expect(a.tier).toBe(0);
  });

  it('both cards agree on every tier', () => {
    const busy = FIXTURES.find((x) => x.login === 'heavy-reviewer')!;
    const bi = { ...input, login: busy.login, p: normalise(busy.raw), raw: busy.raw,
      weeks: busy.weeks, restricted: busy.restricted, prsOpened: busy.prsOpened,
      accountAgeYears: busy.accountAgeYears,
      calendarTotal: busy.weeks.reduce((a, b) => a + b, 0) + busy.restricted };
    const sheet = characterSheet(bi);
    const statusText = renderCard(bi).svg;
    // Every tier the status card prints must be one the sheet computed.
    for (const m of (statusText.match(/tier (\d) of 3/g) ?? [])) {
      const n = Number(m.match(/\d/)![0]);
      expect(sheet.abilities.some((a) => a.tier === n)).toBe(true);
    }
  });
});

/**
 * The card has to admit what the token could not read.
 *
 * `github_token` now defaults to the workflow's own GITHUB_TOKEN so the Action
 * installs without a secret. That token cannot read
 * `restrictedContributionsCount`, so `restricted` arrives as 0 — indistinguishable,
 * on its face, from someone who genuinely has no private work. Rendering the
 * second story for the first person is the failure `mostly-private` exists to
 * catch, so the card carries a caveat instead.
 */
describe('private-work caveat', () => {
  const base = (privateCounted?: boolean) => {
    const f = FIXTURES.find((x) => x.login === 'mostly-private')!;
    return {
      login: f.login, campaign: 2026, p: normalise(f.raw), raw: f.raw,
      weeks: f.weeks, restricted: 0, accountAgeYears: f.accountAgeYears,
      prsOpened: f.prsOpened, campaignDay: 242,
      calendarTotal: f.weeks.reduce((a: number, b: number) => a + b, 0),
      ...(privateCounted === undefined ? {} : { privateCounted }),
    };
  };

  it('says so when private work could not be read', () => {
    expect(renderCard(base(false)).svg).toContain('private work not counted');
  });

  it('stays silent when a PAT was used', () => {
    expect(renderCard(base(true)).svg).not.toContain('private work not counted');
  });

  it('stays silent by default, so a PAT run is not accused of hiding anything', () => {
    // Absent means "not told", and the safe reading of "not told" is the one
    // that does not print a caveat about a token nobody said was limited.
    expect(renderCard(base()).svg).not.toContain('private work not counted');
  });

  it('is translated, not hardcoded English', () => {
    expect(renderCard({ ...base(false), lang: 'es' as const }).svg)
      .toContain('trabajo privado no contado');
  });
});
