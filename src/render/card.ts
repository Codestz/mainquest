/**
 * The card: layout and orchestration only.
 *
 * Layout rule (docs/04): ONE frame. The scene fills the canvas and the windows
 * float over it. The contribution grid is the ground the character stands on,
 * never a chart at the bottom.
 *
 * Determinism (docs/01): no timestamps, integer coordinates, same input ->
 * byte-identical output.
 *
 * Everything this file draws, it delegates. It knows WHERE things go, not how
 * they are chosen or rendered — so the scene, the sigil and the identity layer
 * can all change underneath it.
 */

import { fill, localeFor, type Lang } from '../i18n/locales.js';
import type { Percentiles } from '../derive.js';
import { DISTRIBUTION, MERGES_IS_PROXY, isDegenerate } from '../normalise.js';
import { ABILITY_OF, COUNTED, characterSheet } from './sheet.js';
import {
  DARK, H, MOVING, THEMES, TYPE, W, esc, text, title, window as menu,
  type Motion, type Theme,
} from './theme.js';
import { sky, celestial, starScatter, constellation } from './scene/sky.js';
import { horizon } from './scene/horizon.js';
import { readWeather, weather } from './scene/weather.js';
import { terrain } from './scene/terrain.js';
import { sprite } from './scene/sprite.js';
import { foreground, birds } from './scene/foreground.js';
import { ambience, rankAura } from './scene/aura.js';

export interface CardInput {
  login: string;
  campaign: number;
  /** 0..1 per metric. */
  p: Percentiles;
  raw: Record<string, number>;
  weeks: number[];
  restricted: number;
  accountAgeYears: number;
  prsOpened: number;
  /** 1..365 -- drives the sky. Same for every card rendered the same day. */
  campaignDay: number;
  /** Contribution-calendar total, INCLUDING sealed days. Decides standing. */
  calendarTotal: number;
  /** Viewer preference, not a per-user axis. Defaults to dark. */
  theme?: Theme['name'];
  /** en | es | pt-BR. Unknown values fall back to English rather than throw. */
  lang?: Lang;
  /**
   * Still cards list every ability at once, because there is no cursor to
   * cycle them (docs/04). Motion is a rendering mode, not a post-process.
   */
  motion?: Motion;
}



export interface Card { svg: string; credit: { id: string; author: string }; klass: import('../derive.js').ClassName }

export function renderCard(i: CardInput): Card {
  const L = localeFor(i.lang);
  const th = THEMES[i.theme ?? 'dark'] ?? DARK;
  const motion = i.motion ?? MOVING;
  const t = (
    x: number, y: number, str: string, size: number, fill = th.ink,
    o?: Parameters<typeof text>[5],
  ): string => text(x, y, str, size, fill, o);
  const win = (x: number, y: number, w: number, h: number, label?: string): string =>
    menu(th, x, y, w, h, label);
  // Every derived fact comes from one place, so the two cards cannot disagree.
  const sheet = characterSheet(i);
  const { klass, sub, state, classified, margin, sigil: sig, seal: mark, drift } = sheet;
  const rk = sheet.rank;
  const debs = sheet.debuffs;
  const bands = sky(i.campaignDay, th);

  // The status card ranks only the six COUNTED metrics: `burst` and `weekend`
  // describe the SHAPE that chose the class, so listing them as abilities here
  // would be the card explaining its own working. The ability card prints all
  // eight, which is the place for that.
  const top4 = sheet.abilities
    .filter((a) => (COUNTED as readonly string[]).includes(a.metric))
    .slice(0, 4);
  // Tier comes off the shared sheet so the two cards cannot show a different
  // number of pips for the same ability.
  const tierOfMetric = new Map(sheet.abilities.map((a) => [a.metric, a.tier]));
  const tier = (m: string): number => tierOfMetric.get(m as never) ?? 0;

  let s = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img">`;
  s += `<title>${esc(i.login)} — ${L.classes[klass].name}, ${L.ranks[rk as keyof typeof L.ranks]} — a MainQuest character sheet derived from public GitHub activity</title>`;
  s += `<desc>Class from the shape of contribution activity, not its volume. Sigil is generated from the login and never changes.</desc>`;
  /**
   * Attribution travels WITH the artwork, not just in the repository.
   *
   * The charge in this card's sigil is CC BY 3.0, and this SVG is embedded in
   * READMEs all over the internet on its own. CC BY 3.0 s.4(b) requires
   * attribution "reasonable to the medium or means You are utilizing" — the
   * author's name, the URI, and for an adaptation a credit identifying the
   * use. A NOTICE file left behind in the repository does not travel with the
   * file, so it does not satisfy that for a standalone SVG.
   *
   * <metadata> is the medium's own mechanism for exactly this, and costs ~200
   * bytes.
   */
  s += `<metadata>` +
    `<![CDATA[Heraldic charge "${esc(sig.credit.id.split('/')[1] ?? '')}" by ` +
    `${esc(sig.credit.author)} from game-icons.net (https://game-icons.net), ` +
    `licensed CC BY 3.0 (https://creativecommons.org/licenses/by/3.0/). ` +
    `Recoloured and composited into a heraldic sigil by MainQuest.]]>` +
    `</metadata>`;

  // --- sky: NOT drifted -----------------------------------------------------
  // skyBand is 'fixed' (docs/07#7): every card rendered on the same day gets
  // the same sky. Wrapping the sky in the per-user hue-rotate broke that -- two
  // day-242 cards came out red and orange, and "we are in the same season"
  // stopped being readable. Drift belongs to the ground, not the world.
  s += `<defs><filter id="drift"><feColorMatrix type="hueRotate" values="${drift}"/></filter></defs>`;
  s += `<rect width="${W}" height="130" fill="${bands[0]}"/>`;
  s += `<rect y="130" width="${W}" height="60" fill="${bands[1]}"/>`;
  s += `<rect y="190" width="${W}" height="70" fill="${bands[2]}"/>`;

  // starScatter is 'fixed' — identical for everyone, so that the constellation
  // drawn over it is the ONLY starfield carrying signal.
  s += starScatter(th, motion.animate);
  // Birds ride in the sky layer so they pass BEHIND the menu windows —
  // emerging from one and vanishing into the other is what sells the distance.
  const wx = readWeather(i.weeks, i.campaignDay);
  if (wx === 'clear' || wx === 'drifting') s += birds(th, motion.animate);
  s += celestial(i.campaignDay, th, motion.animate);
  // constellation is 'data' — the campaign's peak weeks, joined in order.
  s += constellation(i.weeks, th, motion.animate);

  // --- ground: drifted (seeded, per campaign) -------------------------------
  s += `<g filter="url(#drift)">`;
  s += horizon(i.weeks, 252, th);
  s += terrain(i.weeks, 24, 258, th, motion);
  s += `</g>`;

  // weather is 'data' — the last 30 days against this profile's OWN baseline,
  // never against other people. Sits between the ridges and the ground.
  s += weather(wx, th, 250, motion.animate);

  // The gap between the status window and the ability window was dead space.
  const familiar = sheet.familiar;
  // Ground first, then figure, then air: the three layers the character needs
  // in order to be standing somewhere instead of pasted on.
  // Rank is gated on 'not unclassed', not on 'classed'. A sealed account's
  // identity line still says "Sealed · Master" — rank comes from public
  // reviews and PRs, which survive the seal. It is the CLASS that is withheld,
  // so it is the class ambience, below, that has to stay silent.
  if (state !== 'unclassed') s += rankAura(rk, 416, 258, th, motion.animate);
  // The art must not claim what the text declines to.
  s += sprite(416, 258, classified ? klass : 'novice', familiar, 2, th, motion);
  if (classified) s += ambience(klass, 416, 258, motion.animate);

  // The near bank, in front of the grid the character stands on.
  s += `<g filter="url(#drift)">${foreground(i.weeks, 296, th)}</g>`;

  // --- status window ---
  s += win(16, 16, 320, 128);
  s += `<g transform="translate(26 26)">${sig.svg}</g>`;
  s += t(84, 44, i.login, TYPE.name, th.ink, { track: 0.5 });

  if (classified) {
    s += t(84, 62, `${title(L.classes[klass].name)} · ${title(L.ranks[rk as keyof typeof L.ranks])}`,
      TYPE.identity, th.accent);
    s += t(84, 78, L.classes[klass].epithet, TYPE.detail, th.edge, { opacity: 0.85 });
    s += t(84, 92, margin > 0.12
      ? fill(L.ui.true_class, { class: title(L.classes[klass].name) })
      : margin < 0.03
        ? fill(L.ui.hybrid, { class: title(L.classes[sub].name) })
        : fill(L.ui.path_of, { class: title(L.classes[sub].name) }),
      TYPE.detail, th.edge, { opacity: 0.7 });
  } else if (state === 'sealed') {
    s += t(84, 62, `${L.ui.standing_sealed} · ${title(L.ranks[rk as keyof typeof L.ranks])}`,
      TYPE.identity, th.accent);
    s += t(84, 78, L.ui.sealed_epithet, TYPE.detail, th.edge, { opacity: 0.85 });
    s += t(84, 92, L.ui.sealed_note, TYPE.detail, th.edge, { opacity: 0.7 });
  } else {
    s += t(84, 62, L.ui.standing_unclassed, TYPE.identity, th.accent);
    s += t(84, 78, L.ui.unclassed_note, TYPE.detail, th.edge, { opacity: 0.85 });
  }

  /**
   * `statBars` — 'data'. Declared in the axis policy and, until now, never
   * built: the original mockup showed `cmt ████████░░ 1.284` and the renderer
   * simply never drew it.
   *
   * Two bars, because two is a comparison and six is a chart — and a chart is
   * what this card exists not to be. Commits against reviews is the single
   * ratio the whole thesis rests on.
   */
  const bar = (bx: number, by: number, label: string, v: number, n: number): string => {
    const w = 118;
    const fill = Math.max(2, Math.round(w * v));
    return t(bx, by + 7, label.toUpperCase(), TYPE.fine, th.edge, { track: 1 }) +
      `<rect x="${bx + 32}" y="${by}" width="${w}" height="8" fill="${th.row}"/>` +
      `<rect x="${bx + 32}" y="${by}" width="${fill}" height="8" fill="${th.accent}"/>` +
      `<rect x="${bx + 32}" y="${by}" width="${w}" height="8" fill="none" ` +
      `stroke="${th.edge}" stroke-width="1" opacity=".5"/>` +
      t(bx + 32 + w + 34, by + 7, String(n), TYPE.fine, th.dim, { anchor: 'end' });
  };
  s += bar(26, 106, 'cmt', i.p.commits, i.raw['commits'] ?? 0);
  s += bar(26, 120, 'rev', i.p.reviews, i.raw['reviews'] ?? 0);

  // Inside the window. It sat below it before, floating on the sky, which read
  // as a caption that had slipped out of its box.
  s += t(26, 138, `${fill(L.ui.campaign, { year: i.campaign })} · ${L.ui.day} ${i.campaignDay}`,
    TYPE.fine, th.dim, { opacity: 0.8 });

  // --- ability window ---
  s += win(560, 16, 304, 186, L.ui.abilities);
  top4.forEach(({ metric: m }, n) => {
    const key = ABILITY_OF[m]!;
    const y = 58 + n * 27;
    if (motion.animate) {
      // Highlight and cursor share ONE <animate> on a wrapping <g>. They were
      // two elements running the identical keyframes on the identical clock:
      // four rows spent eight of the forty-element budget saying one thing.
      s += `<g opacity="0"><animate attributeName="opacity" values="1;0;0;0" dur="12s" begin="${n * 3}s" repeatCount="indefinite" calcMode="discrete"/>` +
        `<rect x="566" y="${y - 14}" width="292" height="23" fill="${th.row}"/>` +
        // A pointing glyph rather than a ">" — the cursor is chrome, not text.
        `<polygon points="574,${y - 5} 582,${y - 1} 574,${y + 3}" fill="${th.accent}"/></g>`;
    }
    s += t(590, y + 1, L.abilities[key].name, TYPE.body);
    const tr = tier(m);
    for (let k = 0; k < 3; k++) {
      s += `<rect x="${812 + k * 12}" y="${y - 7}" width="8" height="8" ` +
        `fill="${k < tr ? th.accent : th.edge}" opacity="${k < tr ? 1 : 0.25}"/>`;
    }
  });
  if (debs.length) {
    const d = debs[0]! as keyof typeof L.debuffs;
    s += t(576, 186, `${title(L.debuffs[d].name)} · ${L.ui.debuff}`, TYPE.detail, th.warn);
  }

  // --- description window ---
  // The still card has no cursor cycling, so its description window can be
  // taller and carry every ability at once (docs/04).
  s += motion.animate ? win(16, 336, 848, 68) : win(16, 316, 848, 88);
  if (motion.animate) {
    top4.forEach(({ metric: m }, n) => {
      const key = ABILITY_OF[m]!;
      s += `<g opacity="0"><animate attributeName="opacity" values="1;0;0;0" dur="12s" begin="${n * 3}s" repeatCount="indefinite" calcMode="discrete"/>` +
        t(30, 360, L.abilities[key].effect, 12) +
        t(30, 378, `${L.ui.measures_prefix} ${L.abilities[key].measures}`, 11, th.edge) +
        t(30, 394, `${fill(L.ui.casts_this_campaign, { n: i.raw[m] ?? 0 })} · ${fill(L.ui.tier, { n: tier(m) })}`, 11, th.dim) +
        `</g>`;
    });
  } else {
    // Nothing cycles, so the description window cannot show one ability's
    // prose. It shows the `mide:` line for ALL of them instead — the line
    // docs/03 calls load-bearing, because someone who ignores the RPG framing
    // reads only those and still gets a stats card.
    // Two columns, two rows. Four columns cannot hold the `measures:` line in
    // ANY locale: the longest is 46 chars in Spanish (`sabbath`), which needs
    // 248px at 9px monospace against the 184px a quarter-width column allows.
    // src/i18n/fit.ts exists to make that a build error rather than a card
    // that silently runs its text into the next column, and test/fit.test.ts
    // now enforces it across all three locales.
    const COL_W = 410;
    top4.forEach(({ metric: m }, n) => {
      const key = ABILITY_OF[m]!;
      const col = 30 + (n % 2) * COL_W;
      const row = 340 + Math.floor(n / 2) * 28;
      s += t(col, row, L.abilities[key].name, 11, th.ink);
      s += t(col, row + 12, `${L.ui.measures_prefix} ${L.abilities[key].measures}`, 9, th.edge);
      s += t(col + 300, row, `${i.raw[m] ?? 0} · ${fill(L.ui.tier, { n: tier(m) })}`, 9, th.dim);
    });
  }
  if (!motion.animate && i.restricted > 0) {
    s += t(30, 398, `${L.ui.sealed_activity}: ${i.restricted}`, 9, th.accent);
  }
  // Say what the tiers rest on. A distribution note in small type is cheap;
  // a card that silently implies rigour it does not have is not.
  const caveats: string[] = [];
  if (isDegenerate('reviews')) caveats.push(L.ui.caveat_reviews);
  if (MERGES_IS_PROXY) caveats.push(L.ui.caveat_merges);

  /**
   * The whole bottom-right column is ONE right-anchored stack.
   *
   * It used to be four independent absolute placements — sealed activity at
   * (672,358), the caveats joined onto one line at (672,372), the sample note
   * at (672,384) and the seal at (790,396) — each sized for English and for
   * the assumption that only one caveat ever fires. Two caveats ran 100px off
   * an 880px canvas, and Spanish put the sample note straight through the
   * seal.
   *
   * Stacking upward from a fixed baseline means any number of lines in any
   * language lands in the same column and cannot collide.
   */
  if (motion.animate) {
    const lines: Array<[string, string, number]> = [];
    if (i.restricted > 0) {
      lines.push([`${L.ui.sealed_activity}: ${i.restricted}`, th.accent, 11]);
    }
    for (const c of caveats) lines.push([c, th.warn, 9]);
    lines.push([`n=${DISTRIBUTION.sampleSize} · ${DISTRIBUTION.generated}`, th.edge, 9]);
    lines.push([mark, th.edge, 10]);

    const bottom = 396;
    lines.forEach(([line, col, size], k) => {
      s += t(858, bottom - (lines.length - 1 - k) * 12, line, size, col, { anchor: 'end' });
    });
  } else {
    if (caveats.length) s += t(200, 398, caveats.join(' · '), 9, th.warn);
    s += t(640, 398, `n=${DISTRIBUTION.sampleSize} · ${DISTRIBUTION.generated}`, 9, th.edge);
    s += t(858, 398, mark, 9, th.edge, { anchor: 'end' });
  }
  s += `</svg>`;

  return { svg: s, credit: sig.credit, klass };
}
