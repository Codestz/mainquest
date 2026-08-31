/**
 * The three locales, and the one place that picks between them.
 *
 * `lang` was an Action input for the whole of v1: documented, defaulted, and
 * wired to nothing — every renderer did `import en from locales/en.json` and
 * used it directly. The files were complete and the layout tests validated
 * every string in all three; nothing loaded them.
 *
 * Wiring it was never just plumbing. Fifteen user-visible strings lived as
 * literals in the renderers — "Sealed", "the campaign has not begun",
 * "Path of the {class}" — so simply swapping the import would have produced a
 * Spanish card with English standing lines. Those strings are now in `ui`,
 * in all three files, which is why this landed as one change rather than two.
 */

import en from '../../locales/en.json' with { type: 'json' };
import es from '../../locales/es.json' with { type: 'json' };
import ptBR from '../../locales/pt-BR.json' with { type: 'json' };

/** English is the shape every other locale must match. */
export type Locale = typeof en;
export type Lang = 'en' | 'es' | 'pt-BR';

export const LANGS: readonly Lang[] = ['en', 'es', 'pt-BR'];

/**
 * The casts are load-bearing but not dangerous: `test/i18n.test.ts` asserts
 * every locale has exactly the key set of `en`, so a missing string is a test
 * failure rather than an `undefined` rendered into an SVG.
 */
export const LOCALES: Record<Lang, Locale> = {
  'en': en,
  'es': es as unknown as Locale,
  'pt-BR': ptBR as unknown as Locale,
};

export const isLang = (v: unknown): v is Lang =>
  typeof v === 'string' && (LANGS as readonly string[]).includes(v);

/**
 * Falls back to English rather than throwing.
 *
 * A card is a daily scheduled job whose output is committed to someone's
 * profile. Failing the whole run over a typo in a workflow input would replace
 * a working card with a red X; rendering English does not.
 */
export const localeFor = (lang?: string): Locale =>
  isLang(lang) ? LOCALES[lang] : LOCALES.en;

/** Interpolate `{name}` placeholders. */
export const fill = (s: string, vars: Record<string, string | number>): string =>
  s.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m));
