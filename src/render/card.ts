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
import { ACCENT, DIM, EDGE, H, ROW, W, esc, t, win } from './theme.js';
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
}


const ABILITY_OF: Record<string, keyof typeof en.abilities> = {
  commits: 'sustained_strike', reviews: 'second_opinion', merges: 'close_the_loop',
  streak: 'endurance', repos: 'open_fronts', issues: 'tracking',
};

const tier = (v: number): number => (v >= 0.85 ? 3 : v >= 0.5 ? 2 : 1);


export interface Card { svg: string; credit: { id: string; author: string }; klass: import('../derive.js').ClassName }

export function renderCard(i: CardInput): Card {
  const L = en;
  const [klass, sub] = classify(i.p);
  // What the card is entitled to claim, given what it can see.
  const state = standing(i.p, { sealed: i.restricted, total: i.calendarTotal });
  const classified = state === 'classed';
  const margin = classMargin(i.p);
  const rk = rank(i.raw['reviews'] ?? 0, i.prsOpened, i.accountAgeYears);
  const debs = debuffs(i.p);
  const sig = composeSigil(i.login, i.campaign, 40);
  const bands = sky(i.campaignDay);
  const mark = seal(campaignSeed(i.login, i.campaign));

  // paletteDrift is the per-campaign seeded axis: it tints the WORLD only,
  // never the chrome (docs/04).
  const drift = Math.round((streamForAxis(i.login, i.campaign, 'paletteDrift')() - 0.5) * 36);

  const metrics = ['commits', 'reviews', 'merges', 'streak', 'repos', 'issues'] as const;
  const top4 = [...metrics].sort((a, b) => i.p[b] - i.p[a]).slice(0, 4);

  let s = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img">`;
  s += `<title>${esc(i.login)} — ${L.classes[klass].name}, ${L.ranks[rk as keyof typeof L.ranks]} — a Questlog character sheet derived from public GitHub activity</title>`;
  s += `<desc>Class from the shape of contribution activity, not its volume. Sigil is generated from the login and never changes.</desc>`;

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
    s += `<rect x="${x}" y="${y}" width="3" height="3" fill="#F2F0D8" opacity=".6">` +
      `<animate attributeName="opacity" values=".2;1;.2" dur="${3 + (n % 4)}s" begin="${n * 0.4}s" repeatCount="indefinite"/></rect>`;
  }
  // --- ground: drifted (seeded, per campaign) -------------------------------
  s += `<g filter="url(#drift)">`;
  s += horizon(i.weeks, 252, '#2B2258');
  s += terrain(i.weeks, 24, 258);
  s += `</g>`;
    // The gap between the status window (ends x=316) and the ability window
  // (starts x=560) was dead space. The character belongs there.
  const familiar = pick(streamForAxis(i.login, i.campaign, 'spriteAccessory'), FAMILIARS);
  // The art must not claim what the text declines to. Rendering the berserker
  // sprite beside "unclassed" said two different things at once — `novice` is
  // a deliberately plain, unarmed figure, and it is NOT a thirteenth class.
  s += sprite(416, 258, classified ? klass : 'novice', familiar, 2);

  // --- status window ---
  s += win(16, 16, 300, 104);
  s += `<g transform="translate(24 22)">${sig.svg}</g>`;
  s += t(76, 42, i.login, 14);
  if (classified) {
    s += t(76, 60, `${L.classes[klass].name} · ${L.ranks[rk as keyof typeof L.ranks]}`, 11, ACCENT);
    s += t(76, 76, `${L.classes[klass].epithet}`, 11, EDGE);
    // Margin is shape, not merit: a textbook example of an archetype and a
    // hybrid who fits none cleanly are both interesting, neither is better.
    s += t(76, 92, margin > 0.12
      ? `true ${L.classes[klass].name}`
      : margin < 0.03
        ? `hybrid · also ${L.classes[sub].name}`
        : `path of the ${L.classes[sub].name}`, 11, EDGE);
  } else if (state === 'sealed') {
    // The rhythm is real (the calendar counts private days); the role is not
    // knowable, because a restricted count carries no type.
    s += t(76, 60, `sealed · ${L.ranks[rk as keyof typeof L.ranks]}`, 11, ACCENT);
    s += t(76, 76, 'the work is behind a door', 11, EDGE);
    s += t(76, 92, 'rhythm known, role not', 11, EDGE);
  } else {
    s += t(76, 60, 'unclassed', 11, ACCENT);
    s += t(76, 76, 'the campaign has not begun', 11, EDGE);
  }
  s += t(24, 112, `${L.ui.campaign.replace('{year}', String(i.campaign))} · day ${i.campaignDay}`, 10, DIM);

  // --- ability window ---
  s += win(560, 16, 304, 176);
  s += t(574, 38, L.ui.abilities, 12, DIM);
  top4.forEach((m, n) => {
    const key = ABILITY_OF[m]!;
    const y = 60 + n * 26;
    s += `<rect x="566" y="${y - 13}" width="292" height="22" fill="${ROW}" opacity="0">` +
      `<animate attributeName="opacity" values="1;0;0;0" dur="12s" begin="${n * 3}s" repeatCount="indefinite" calcMode="discrete"/></rect>`;
    s += `<text x="576" y="${y + 2}" font-family="ui-monospace,monospace" font-size="12" fill="${ACCENT}" opacity="0">&gt;` +
      `<animate attributeName="opacity" values="1;0;0;0" dur="12s" begin="${n * 3}s" repeatCount="indefinite" calcMode="discrete"/></text>`;
    s += t(590, y + 2, L.abilities[key].name, 12);
    const tr = tier(i.p[m]);
    for (let k = 0; k < 3; k++) {
      s += `<rect x="${812 + k * 12}" y="${y - 6}" width="8" height="8" fill="${k < tr ? ACCENT : EDGE}" opacity="${k < tr ? 1 : 0.3}"/>`;
    }
  });
  if (debs.length) {
    const d = debs[0]! as keyof typeof L.debuffs;
    s += t(576, 176, `${L.debuffs[d].name} · debuff`, 11, '#E0708A');
  }

  // --- description window ---
  s += win(16, 336, 848, 68);
  top4.forEach((m, n) => {
    const key = ABILITY_OF[m]!;
    const g = `<g opacity="0"><animate attributeName="opacity" values="1;0;0;0" dur="12s" begin="${n * 3}s" repeatCount="indefinite" calcMode="discrete"/>` +
      t(30, 360, L.abilities[key].effect, 12) +
      t(30, 378, `${L.ui.measures_prefix} ${L.abilities[key].measures}`, 11, EDGE) +
      t(30, 394, `${L.ui.casts_this_campaign.replace('{n}', String(i.raw[m] ?? 0))} · ${L.ui.tier.replace('{n}', String(tier(i.p[m])))}`, 11, DIM) +
      `</g>`;
    s += g;
  });
  if (i.restricted > 0) {
    s += t(660, 360, `${L.ui.sealed_activity}: ${i.restricted}`, 11, ACCENT);
  }
  s += t(790, 394, mark, 10, EDGE);
  // Say what the tiers rest on. A distribution note in small type is cheap;
  // a card that silently implies rigour it does not have is not.
  const caveats: string[] = [];
  if (isDegenerate('reviews')) caveats.push('reviews: sparse in sample');
  if (MERGES_IS_PROXY) caveats.push('merges: proxied by PRs opened');
  if (caveats.length) s += t(600, 378, caveats.join(' · '), 9, '#E0708A');
  s += t(600, 394, `n=${DISTRIBUTION.sampleSize} · ${DISTRIBUTION.generated}`, 9, EDGE);
  s += `</svg>`;

  return { svg: s, credit: sig.credit, klass };
}
