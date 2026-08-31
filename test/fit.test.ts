import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fits, SLOTS } from '../src/i18n/fit.js';

/**
 * SVG has no text wrapping. A string that overflows its window just
 * runs off the edge, SILENTLY — and Portuguese and Spanish run 20-30% longer
 * than English. This is the test that turns that into a build error.
 *
 * It already caught a real one: the still card's four-column ability layout
 * held English at 200px but needed 248px for Spanish `sabbath`.
 */
const LOCALES = ['en', 'es', 'pt-BR'] as const;

describe('i18n fit — no locale may overflow its slot', () => {
  for (const lang of LOCALES) {
    const L = JSON.parse(readFileSync(`locales/${lang}.json`, 'utf8'));

    it(`${lang}: ability names fit both layouts`, () => {
      for (const [key, a] of Object.entries(L.abilities) as Array<[string, { name: string }]>) {
        expect(fits(a.name, SLOTS['ability.name'].size, SLOTS['ability.name'].max), `${key}: ${a.name}`).toBe(true);
        expect(fits(a.name, SLOTS['still.ability.name'].size, SLOTS['still.ability.name'].max), key).toBe(true);
      }
    });

    it(`${lang}: measures lines fit the still card's column`, () => {
      for (const [key, a] of Object.entries(L.abilities) as Array<[string, { measures: string }]>) {
        const line = `${L.ui.measures_prefix} ${a.measures}`;
        expect(fits(line, SLOTS['still.ability.measures'].size, SLOTS['still.ability.measures'].max),
          `${key}: "${line}" (${line.length} chars)`).toBe(true);
      }
    });

    it(`${lang}: every ability line fits the ability card's column`, () => {
      for (const [key, a] of Object.entries(L.abilities) as
        Array<[string, { name: string; effect: string; measures: string }]>) {
        const S = SLOTS;
        expect(fits(a.name, S['sheet.ability.name'].size, S['sheet.ability.name'].max),
          `${key} name`).toBe(true);
        expect(fits(a.effect, S['sheet.ability.effect'].size, S['sheet.ability.effect'].max),
          `${key} effect: "${a.effect}" (${a.effect.length} chars)`).toBe(true);
        const line = `${L.ui.measures_prefix} ${a.measures}`;
        expect(fits(line, S['sheet.ability.measures'].size, S['sheet.ability.measures'].max),
          `${key} measures: "${line}"`).toBe(true);
      }
    });

    it(`${lang}: shape adjectives clear the provenance column`, () => {
      // These sit on the same row as the right-anchored caveat stack. Too long
      // and they run into it — which English would never reveal, because the
      // English adjectives are the shortest of the three locales.
      for (const k of ['shape_bursty', 'shape_steady', 'shape_weekend', 'shape_weekday'] as const) {
        const s = L.ui[k] as string;
        expect(fits(s, SLOTS['desc.shapeAdjective'].size, SLOTS['desc.shapeAdjective'].max),
          `${k}: "${s}" (${s.length} chars)`).toBe(true);
      }
    });

    it(`${lang}: class epithets fit the status window`, () => {
      for (const [key, c] of Object.entries(L.classes) as Array<[string, { epithet: string }]>) {
        expect(fits(c.epithet, SLOTS['status.epithet'].size, SLOTS['status.epithet'].max), key).toBe(true);
      }
    });

    it(`${lang}: ability effect prose fits the description window`, () => {
      for (const [key, a] of Object.entries(L.abilities) as Array<[string, { effect: string }]>) {
        expect(fits(a.effect, SLOTS['desc.effect'].size, SLOTS['desc.effect'].max),
          `${key}: "${a.effect}" (${a.effect.length} chars)`).toBe(true);
      }
    });
  }
});
