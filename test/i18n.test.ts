import { describe, expect, it } from 'vitest';
import { FIXTURES } from '../src/fixtures.js';
import { fits } from '../src/i18n/fit.js';
import { LANGS, LOCALES, isLang, localeFor, fill, type Lang } from '../src/i18n/locales.js';
import { normalise } from '../src/normalise.js';
import { renderCard } from '../src/render/card.js';
import { renderAbilities } from '../src/render/abilities.js';
import { STILL } from '../src/render/theme.js';

/**
 * `lang` was an Action input for the whole of v1 that was wired to nothing.
 * These are the tests that stop it silently coming loose again.
 */

const keysOf = (o: unknown, pre = ''): string[] => {
  if (typeof o !== 'object' || o === null) return [];
  return Object.entries(o as Record<string, unknown>).flatMap(([k, v]) => {
    const path = pre ? `${pre}.${k}` : k;
    return [path, ...keysOf(v, path)];
  });
};

describe('every locale matches English exactly', () => {
  const base = keysOf(LOCALES.en).sort();
  for (const lang of LANGS) {
    it(`${lang}: same key set as en`, () => {
      expect(keysOf(LOCALES[lang]).sort()).toEqual(base);
    });
    it(`${lang}: no empty strings`, () => {
      const empty = keysOf(LOCALES[lang]).filter((path) => {
        const v = path.split('.').reduce<unknown>(
          (o, k) => (o as Record<string, unknown>)?.[k], LOCALES[lang]);
        return typeof v === 'string' && v.trim() === '';
      });
      expect(empty).toEqual([]);
    });
  }
});

describe('placeholders survive translation', () => {
  // A locale that drops `{n}` renders "tier of 3" and nothing catches it.
  const WITH_VARS: Array<[string, string[]]> = [
    ['ui.tier', ['n']],
    ['ui.casts_this_campaign', ['n']],
    ['ui.campaign', ['year']],
    ['ui.true_class', ['class']],
    ['ui.hybrid', ['class']],
    ['ui.path_of', ['class']],
    ['ui.percentile_note', ['n']],
  ];
  for (const lang of LANGS) {
    for (const [path, vars] of WITH_VARS) {
      it(`${lang}: ${path} keeps ${vars.join(', ')}`, () => {
        const s = path.split('.').reduce<any>((o, k) => o[k], LOCALES[lang]) as string;
        for (const v of vars) expect(s).toContain(`{${v}}`);
      });
    }
  }
  it('fill leaves unknown placeholders alone rather than printing undefined', () => {
    expect(fill('tier {n} of {max}', { n: 2 })).toBe('tier 2 of {max}');
  });
});

/**
 * The slots the newly-localised strings land in. Every one of these was an
 * English literal in a renderer until `lang` was wired, so none of them had
 * ever been measured in any other language.
 */
const SLOTS = {
  'status.identity': { size: 12, max: 246 },   // x=84 -> the window edge
  'status.epithet': { size: 10, max: 246 },
  'status.path': { size: 10, max: 246 },
  'status.campaign': { size: 9, max: 300 },    // x=26, inside the window
  'ability.debuff': { size: 10, max: 288 },    // x=576 -> 864
  'sheet.percentile': { size: 9, max: 500 },   // right-anchored in the footer
  'card.caveat': { size: 9, max: 240 },        // right-anchored, one per line
} as const;

describe('localised UI strings fit their slots', () => {
  for (const lang of LANGS) {
    const L = LOCALES[lang];
    const ok = (s: string, slot: keyof typeof SLOTS) =>
      expect(fits(s, SLOTS[slot].size, SLOTS[slot].max), `${lang} ${slot}: "${s}"`).toBe(true);

    it(`${lang}: standing lines fit the status window`, () => {
      // `ranks.subtitle` lives in the ranks object but is not a rank — it is
      // the sentence explaining what rank means. Including it here measured a
      // 46-character "rank" that the card never prints on that line.
      const RANKS = ['apprentice', 'journeyman', 'veteran', 'master', 'archon'] as const;
      const longestRank = RANKS.map((r) => L.ranks[r])
        .sort((a, b) => b.length - a.length)[0]!;
      ok(`${L.ui.standing_sealed} · ${longestRank}`, 'status.identity');
      ok(L.ui.standing_unclassed, 'status.identity');
      ok(L.ui.sealed_epithet, 'status.epithet');
      ok(L.ui.sealed_note, 'status.path');
      ok(L.ui.unclassed_note, 'status.epithet');
      // Every class name can land in every path phrase.
      const longestClass = Object.values(L.classes)
        .map((c) => c.name).sort((a, b) => b.length - a.length)[0]!;
      for (const key of ['true_class', 'hybrid', 'path_of'] as const) {
        ok(fill(L.ui[key], { class: longestClass }), 'status.path');
      }
      // And every class name pairs with every rank on the identity line.
      for (const c of Object.values(L.classes)) {
        ok(`${c.name} · ${longestRank}`, 'status.identity');
      }
    });

    it(`${lang}: provenance and debuff lines fit`, () => {
      ok(`${fill(L.ui.campaign, { year: 2026 })} · ${L.ui.day} 365`, 'status.campaign');
      for (const d of Object.values(L.debuffs)) {
        ok(`${d.name} · ${L.ui.debuff}`, 'ability.debuff');
      }
      ok(fill(L.ui.percentile_note, { n: 165 }), 'sheet.percentile');
      // Each caveat is now its own right-anchored line, never joined.
      ok(L.ui.caveat_reviews, 'card.caveat');
      ok(L.ui.caveat_merges, 'card.caveat');
      ok(L.ui.no_debuffs, 'sheet.percentile');
    });
  }
});

describe('the renderers actually use the locale', () => {
  const f = FIXTURES.find((x) => x.login === 'heavy-reviewer')!;
  const input = (lang?: Lang) => ({
    login: f.login, campaign: 2026, p: normalise(f.raw), raw: f.raw,
    weeks: f.weeks, restricted: f.restricted, accountAgeYears: f.accountAgeYears,
    prsOpened: f.prsOpened, campaignDay: 242, calendarTotal: 9999,
    ...(lang ? { lang } : {}),
  });

  it('renders different text per language, on both cards', () => {
    const en = renderCard(input('en')).svg;
    const es = renderCard(input('es')).svg;
    const pt = renderCard(input('pt-BR')).svg;
    expect(new Set([en, es, pt]).size).toBe(3);
    // The window label is a header: uppercased and tracked by theme.ts.
    expect(es).toContain(LOCALES.es.ui.abilities.toUpperCase());
    expect(pt).toContain(LOCALES['pt-BR'].ui.abilities.toUpperCase());

    const esSheet = renderAbilities(input('es')).svg;
    expect(esSheet).toContain(LOCALES.es.ui.no_debuffs.split(' ')[0]!);
    expect(esSheet).not.toBe(renderAbilities(input('en')).svg);
  });

  it('the sealed and unclassed lines are localised too', () => {
    const sealed = FIXTURES.find((x) => x.login === 'mostly-private')!;
    const svg = renderCard({
      ...input('es'), login: sealed.login, p: normalise(sealed.raw), raw: sealed.raw,
      weeks: sealed.weeks, restricted: sealed.restricted, calendarTotal: 1880,
      prsOpened: sealed.prsOpened, accountAgeYears: sealed.accountAgeYears,
    }).svg;
    expect(svg).toContain(LOCALES.es.ui.sealed_epithet);
    expect(svg).not.toContain('the work is behind a door');
  });

  it('an unknown lang falls back to English instead of throwing', () => {
    expect(isLang('klingon')).toBe(false);
    expect(localeFor('klingon')).toBe(LOCALES.en);
    expect(localeFor(undefined)).toBe(LOCALES.en);
  });

  it('every locale renders both cards in both motions without overflow risk', () => {
    for (const lang of LANGS) {
      for (const motion of [undefined, STILL]) {
        const svg = renderCard({ ...input(lang), ...(motion ? { motion } : {}) }).svg;
        expect(svg).toContain('</svg>');
        expect(svg).not.toContain('undefined');
      }
      expect(renderAbilities(input(lang)).svg).not.toContain('undefined');
    }
  });
});
