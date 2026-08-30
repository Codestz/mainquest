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

import en from '../../locales/en.json' with { type: 'json' };
import { classify, classMargin, standing, rank, debuffs, type Percentiles } from '../derive.js';
import { campaignSeed, pick, seal, streamForAxis } from '../identity/index.js';
import { DISTRIBUTION, MERGES_IS_PROXY, isDegenerate } from '../normalise.js';
import { composeSigil } from './sigil/index.js';
import {
  DARK, H, MOVING, THEMES, W, esc, text, window as menu,
  type Motion, type Theme,
} from './theme.js';
import { sky } from './scene/sky.js';
import { horizon } from './scene/horizon.js';
import { terrain } from './scene/terrain.js';
import { sprite, FAMILIARS } from './scene/sprite.js';

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
  /**
   * Still cards list every ability at once, because there is no cursor to
   * cycle them (docs/04). Motion is a rendering mode, not a post-process.
   */
  motion?: Motion;
}


const ABILITY_OF: Record<string, keyof typeof en.abilities> = {
  commits: 'sustained_strike', reviews: 'second_opinion', merges: 'close_the_loop',
  streak: 'endurance', repos: 'open_fronts', issues: 'tracking',
};

const tier = (v: number): number => (v >= 0.85 ? 3 : v >= 0.5 ? 2 : 1);


export interface Card { svg: string; credit: { id: string; author: string }; klass: import('../derive.js').ClassName }

export function renderCard(i: CardInput): Card {
  const L = en;
  const th = THEMES[i.theme ?? 'dark'] ?? DARK;
  const motion = i.motion ?? MOVING;
  const t = (x: number, y: number, str: string, size: number, fill = th.ink): string =>
    text(x, y, str, size, fill);
  const win = (x: number, y: number, w: number, h: number): string => menu(th, x, y, w, h);
  const [klass, sub] = classify(i.p);
  // What the card is entitled to claim, given what it can see.
  const state = standing(i.p, { sealed: i.restricted, total: i.calendarTotal });
  const classified = state === 'classed';
  const margin = classMargin(i.p);
  const rk = rank(i.raw['reviews'] ?? 0, i.prsOpened, i.accountAgeYears);
  const debs = debuffs(i.p);
  const sig = composeSigil(i.login, i.campaign, 40);
  const bands = sky(i.campaignDay, th);
  const mark = seal(campaignSeed(i.login, i.campaign));

  // paletteDrift is the per-campaign seeded axis: it tints the WORLD only,
  // never the chrome (docs/04).
  const drift = Math.round((streamForAxis(i.login, i.campaign, 'paletteDrift')() - 0.5) * 36);

  const metrics = ['commits', 'reviews', 'merges', 'streak', 'repos', 'issues'] as const;
  const top4 = [...metrics].sort((a, b) => i.p[b] - i.p[a]).slice(0, 4);

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
  for (let n = 0; n < 14; n++) {
    const x = (n * 137) % W, y = 20 + ((n * 53) % 110);
    s += motion.animate
      ? `<rect x="${x}" y="${y}" width="3" height="3" fill="${th.star}" opacity=".6">` +
        `<animate attributeName="opacity" values=".2;1;.2" dur="${3 + (n % 4)}s" begin="${(n * 0.4).toFixed(1)}s" repeatCount="indefinite"/></rect>`
      : `<rect x="${x}" y="${y}" width="3" height="3" fill="${th.star}" opacity=".6"/>`;
  }
  // --- ground: drifted (seeded, per campaign) -------------------------------
  s += `<g filter="url(#drift)">`;
  s += horizon(i.weeks, 252, th.mountain);
  s += terrain(i.weeks, 24, 258, th, motion);
  s += `</g>`;
    // The gap between the status window (ends x=316) and the ability window
  // (starts x=560) was dead space. The character belongs there.
  const familiar = pick(streamForAxis(i.login, i.campaign, 'spriteAccessory'), FAMILIARS);
  // The art must not claim what the text declines to. Rendering the berserker
  // sprite beside "unclassed" said two different things at once — `novice` is
  // a deliberately plain, unarmed figure, and it is NOT a thirteenth class.
  s += sprite(416, 258, classified ? klass : 'novice', familiar, 2, th, motion);

  // --- status window ---
  s += win(16, 16, 300, 104);
  s += `<g transform="translate(24 22)">${sig.svg}</g>`;
  s += t(76, 42, i.login, 14);
  if (classified) {
    s += t(76, 60, `${L.classes[klass].name} · ${L.ranks[rk as keyof typeof L.ranks]}`, 11, th.accent);
    s += t(76, 76, `${L.classes[klass].epithet}`, 11, th.edge);
    // Margin is shape, not merit: a textbook example of an archetype and a
    // hybrid who fits none cleanly are both interesting, neither is better.
    s += t(76, 92, margin > 0.12
      ? `true ${L.classes[klass].name}`
      : margin < 0.03
        ? `hybrid · also ${L.classes[sub].name}`
        : `path of the ${L.classes[sub].name}`, 11, th.edge);
  } else if (state === 'sealed') {
    // The rhythm is real (the calendar counts private days); the role is not
    // knowable, because a restricted count carries no type.
    s += t(76, 60, `sealed · ${L.ranks[rk as keyof typeof L.ranks]}`, 11, th.accent);
    s += t(76, 76, 'the work is behind a door', 11, th.edge);
    s += t(76, 92, 'rhythm known, role not', 11, th.edge);
  } else {
    s += t(76, 60, 'unclassed', 11, th.accent);
    s += t(76, 76, 'the campaign has not begun', 11, th.edge);
  }
  s += t(24, 112, `${L.ui.campaign.replace('{year}', String(i.campaign))} · day ${i.campaignDay}`, 10, th.dim);

  // --- ability window ---
  s += win(560, 16, 304, 176);
  s += t(574, 38, L.ui.abilities, 12, th.dim);
  top4.forEach((m, n) => {
    const key = ABILITY_OF[m]!;
    const y = 60 + n * 26;
    // The cursor exists to point at ONE ability while the description window
    // shows its text. With no motion there is no cursor and no highlight —
    // every ability is simply listed (docs/04).
    if (motion.animate) {
      s += `<rect x="566" y="${y - 13}" width="292" height="22" fill="${th.row}" opacity="0">` +
        `<animate attributeName="opacity" values="1;0;0;0" dur="12s" begin="${n * 3}s" repeatCount="indefinite" calcMode="discrete"/></rect>`;
      s += `<text x="576" y="${y + 2}" font-family="ui-monospace,monospace" font-size="12" fill="${th.accent}" opacity="0">&gt;` +
        `<animate attributeName="opacity" values="1;0;0;0" dur="12s" begin="${n * 3}s" repeatCount="indefinite" calcMode="discrete"/></text>`;
    }
    s += t(590, y + 2, L.abilities[key].name, 12);
    const tr = tier(i.p[m]);
    for (let k = 0; k < 3; k++) {
      s += `<rect x="${812 + k * 12}" y="${y - 6}" width="8" height="8" fill="${k < tr ? th.accent : th.edge}" opacity="${k < tr ? 1 : 0.3}"/>`;
    }
  });
  if (debs.length) {
    const d = debs[0]! as keyof typeof L.debuffs;
    s += t(576, 176, `${L.debuffs[d].name} · debuff`, 11, th.warn);
  }

  // --- description window ---
  // The still card has no cursor cycling, so its description window can be
  // taller and carry every ability at once (docs/04).
  s += motion.animate ? win(16, 336, 848, 68) : win(16, 316, 848, 88);
  if (motion.animate) {
    top4.forEach((m, n) => {
      const key = ABILITY_OF[m]!;
      s += `<g opacity="0"><animate attributeName="opacity" values="1;0;0;0" dur="12s" begin="${n * 3}s" repeatCount="indefinite" calcMode="discrete"/>` +
        t(30, 360, L.abilities[key].effect, 12) +
        t(30, 378, `${L.ui.measures_prefix} ${L.abilities[key].measures}`, 11, th.edge) +
        t(30, 394, `${L.ui.casts_this_campaign.replace('{n}', String(i.raw[m] ?? 0))} · ${L.ui.tier.replace('{n}', String(tier(i.p[m])))}`, 11, th.dim) +
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
    top4.forEach((m, n) => {
      const key = ABILITY_OF[m]!;
      const col = 30 + (n % 2) * COL_W;
      const row = 340 + Math.floor(n / 2) * 28;
      s += t(col, row, L.abilities[key].name, 11, th.ink);
      s += t(col, row + 12, `${L.ui.measures_prefix} ${L.abilities[key].measures}`, 9, th.edge);
      s += t(col + 300, row, `${i.raw[m] ?? 0} · ${L.ui.tier.replace('{n}', String(tier(i.p[m])))}`, 9, th.dim);
    });
  }
  if (i.restricted > 0) {
    s += motion.animate
      ? t(672, 358, `${L.ui.sealed_activity}: ${i.restricted}`, 11, th.accent)
      : t(30, 398, `${L.ui.sealed_activity}: ${i.restricted}`, 9, th.accent);
  }
  s += t(790, 396, mark, 10, th.edge);
  // Say what the tiers rest on. A distribution note in small type is cheap;
  // a card that silently implies rigour it does not have is not.
  const caveats: string[] = [];
  if (isDegenerate('reviews')) caveats.push('reviews: sparse in sample');
  if (MERGES_IS_PROXY) caveats.push('merges: proxied by PRs opened');
  if (caveats.length) {
    s += motion.animate
      ? t(672, 372, caveats.join(' · '), 9, th.warn)
      : t(200, 398, caveats.join(' · '), 9, th.warn);
  }
  s += motion.animate
    ? t(672, 384, `n=${DISTRIBUTION.sampleSize} · ${DISTRIBUTION.generated}`, 9, th.edge)
    : t(600, 398, `n=${DISTRIBUTION.sampleSize} · ${DISTRIBUTION.generated}`, 9, th.edge);
  s += `</svg>`;

  return { svg: s, credit: sig.credit, klass };
}
