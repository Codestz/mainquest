/**
 * The card. String templating, not a DOM library -- the output is text.
 *
 * Layout rule (docs/04): ONE frame. The scene fills the canvas and the windows
 * float over it. The contribution grid is the ground the character stands on,
 * never a chart at the bottom.
 *
 * Determinism (docs/01): no timestamps, integer coordinates, same input ->
 * byte-identical output.
 */

import en from '../../locales/en.json' with { type: 'json' };
import { classify, rank, debuffs, type ClassName, type Percentiles } from '../derive.js';
import { campaignSeed, seal, streamForAxis } from '../identity.js';
import { DISTRIBUTION, MERGES_IS_PROXY, isDegenerate } from '../normalise.js';
import { composeSigil } from './sigil.js';

const W = 880, H = 420;

// docs/04 palette. Window chrome is identical for every user -- non-negotiable.
const WIN = '#16215C', EDGE = '#6B8CE0', INK = '#FFFFFF', DIM = '#C6D4FF';
const ACCENT = '#FFD866', ROW = '#25317A';

const esc = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const t = (x: number, y: number, s: string, size: number, fill = INK, extra = '') =>
  `<text x="${x}" y="${y}" font-family="ui-monospace,monospace" font-size="${size}" fill="${fill}"${extra}>${esc(s)}</text>`;

/** Classic JRPG menu chrome: square corners, double border, identical always. */
const win = (x: number, y: number, w: number, h: number) =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${WIN}" stroke="${INK}" stroke-width="2"/>` +
  `<rect x="${x + 5}" y="${y + 5}" width="${w - 10}" height="${h - 10}" fill="none" stroke="${EDGE}" stroke-width="1"/>`;

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
}

const ABILITY_OF: Record<string, keyof typeof en.abilities> = {
  commits: 'sustained_strike', reviews: 'second_opinion', merges: 'close_the_loop',
  streak: 'endurance', repos: 'open_fronts', issues: 'tracking',
};

const tier = (v: number): number => (v >= 0.85 ? 3 : v >= 0.5 ? 2 : 1);

/**
 * Sky = day-of-campaign, not peak commit hour (docs/07#3). 'fixed': everyone
 * rendering on the same day gets the same sky, which is what makes the set read
 * as one game.
 *
 * Four hand-picked seasonal palettes, switched discretely -- NOT interpolated.
 * Linear-mixing dawn orange toward night navy runs the midpoint through mud,
 * which is exactly what the first render looked like. Four deliberate looks
 * beat 365 muddy ones, and it keeps docs/04's "three flat bands, never a
 * gradient" rule honest.
 */
const SEASONS: ReadonlyArray<readonly [string, string, string]> = [
  ['#3E2A5C', '#7A4A72', '#C97A62'], // Q1  cold dawn
  ['#2E5E8C', '#4C86B0', '#86BCD4'], // Q2  clear day
  ['#8C4A2E', '#A85C52', '#5E4272'], // Q3  dusk
  ['#141B4D', '#1E2A6B', '#34367F'], // Q4  deep night (docs/04 reference)
];

function sky(day: number): readonly [string, string, string] {
  const q = Math.min(3, Math.max(0, Math.floor((day - 1) / 91.25)));
  return SEASONS[q]!;
}

/** The horizon IS your year: 12 monthly totals become the mountain ridge. */
function horizon(weeks: number[], y: number, colour: string): string {
  const months = Array.from({ length: 12 }, (_, m) => {
    const slice = weeks.slice(Math.floor((m * 52) / 12), Math.floor(((m + 1) * 52) / 12));
    return slice.reduce((a, b) => a + b, 0);
  });
  const max = Math.max(...months, 1);
  const pts = months.map((v, i) => {
    const x = Math.round((i / 11) * W);
    return `${x},${Math.round(y - (v / max) * 58)}`;
  });
  return `<polygon points="0,${H} ${pts.join(' ')} ${W},${H}" fill="${colour}"/>`;
}

/** The contribution grid, drawn as ground rather than as a chart. */
function terrain(weeks: number[], x0: number, y0: number): string {
  const max = Math.max(...weeks, 1);
  const shades = ['#1B3320', '#2A5A32', '#4E9E3A', '#7FD152'];
  let out = '';
  weeks.forEach((v, i) => {
    const lvl = v === 0 ? 0 : Math.min(3, Math.floor((v / max) * 3) + 1);
    const x = x0 + i * 16;
    for (let r = 0; r < 4; r++) {
      const jitter = (i * 7 + r * 13) % 3;
      out += `<rect x="${x}" y="${y0 + r * 10}" width="15" height="9" fill="${shades[Math.max(0, Math.min(3, lvl - (r > 1 ? 1 : 0) + (jitter === 0 ? 0 : 0)))]}" opacity="${1 - r * 0.14}"/>`;
    }
  });
  return `<g>${out}<animate attributeName="opacity" from="0" to="1" dur="0.9s" fill="freeze"/></g>`;
}

/**
 * Placeholder silhouette. Real sprites are a commission (docs/07#5).
 *
 * Light on dark with a dark outline: the first version was #1B1540 on the
 * terrain and simply vanished. A placeholder that cannot be seen is worse than
 * no placeholder -- it hides the layout problem it exists to expose.
 *
 * `y` is the ground line: the figure stands ON it rather than floating above.
 */
function sprite(x: number, groundY: number): string {
  const body = '#C6D4FF', edge = '#141B4D', metal = '#FFD866';
  const g = (dy: number) => groundY - dy;
  return `<g transform="translate(${x} 0)">` +
    `<animateTransform attributeName="transform" type="translate" additive="sum" ` +
    `values="0 0; 0 -3; 0 0" dur="1.8s" repeatCount="indefinite"/>` +
    `<ellipse cx="0" cy="${groundY + 2}" rx="18" ry="4" fill="#0B1A10" opacity=".45"/>` +
    `<rect x="-11" y="${g(56)}" width="22" height="18" fill="${body}" stroke="${edge}" stroke-width="2"/>` +
    `<rect x="-6" y="${g(50)}" width="12" height="4" fill="${edge}"/>` +
    `<rect x="-14" y="${g(38)}" width="28" height="24" fill="${body}" stroke="${edge}" stroke-width="2"/>` +
    `<rect x="-13" y="${g(14)}" width="10" height="14" fill="${body}" stroke="${edge}" stroke-width="2"/>` +
    `<rect x="3" y="${g(14)}" width="10" height="14" fill="${body}" stroke="${edge}" stroke-width="2"/>` +
    `<rect x="16" y="${g(52)}" width="4" height="42" fill="${metal}" stroke="${edge}" stroke-width="2"/>` +
    `<rect x="12" y="${g(14)}" width="12" height="5" fill="${edge}"/>` +
    `</g>`;
}

export interface Card { svg: string; credit: { id: string; author: string }; klass: ClassName }

export function renderCard(i: CardInput): Card {
  const L = en;
  const [klass, sub] = classify(i.p);
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
  s += sprite(430, 258);

  // --- status window ---
  s += win(16, 16, 300, 104);
  s += `<g transform="translate(24 22)">${sig.svg}</g>`;
  s += t(76, 42, i.login, 14);
  s += t(76, 60, `${L.classes[klass].name} · ${L.ranks[rk as keyof typeof L.ranks]}`, 11, ACCENT);
  s += t(76, 76, `${L.classes[klass].epithet}`, 11, EDGE);
  s += t(76, 92, `path of the ${L.classes[sub].name}`, 11, EDGE);
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
