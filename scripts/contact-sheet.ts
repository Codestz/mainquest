/**
 * Contact sheet generator for the sigil charge table.
 *
 * The charge table needs ~192 game-icons.net paths that still READ at 28px.
 * Most of the 4,239 do not: past roughly 2,000 path characters an icon turns
 * to mush at that size, and you cannot tell which ones from the name.
 *
 * Screening 4,239 icons one at a time is the thing to avoid, so this does the
 * mechanical filtering (complexity, theme) and leaves only the judgement call:
 * look at a wall of 28px glyphs, in both themes, and reject the mushy ones.
 *
 *   npm run sheet                    # heraldic themes, default complexity band
 *   npm run sheet -- --all           # every icon that passes the complexity band
 *   npm run sheet -- --max=1600      # tighter legibility band
 *
 * Output: build/contact-sheet.html  (open it, click to reject, export JSON)
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { readdirSync, statSync } from 'node:fs';
import { join, basename, dirname } from 'node:path';

// --- config ----------------------------------------------------------------

// Defaults to the vendored checkout so `npm run sheet` works with no env set.
// `npm run icons` clones it; vendor/ is gitignored (4,239 files, not ours).
const ICONS_ROOT = process.env['GAME_ICONS'] ?? 'vendor/game-icons';
const OUT = 'build/contact-sheet.html';

const arg = (k: string, d: number): number => {
  const hit = process.argv.find((a) => a.startsWith(`--${k}=`));
  return hit ? Number(hit.split('=')[1]) : d;
};
const MIN_LEN = arg('min', 300);    // below this, too plain to read as a charge
const MAX_LEN = arg('max', 2000);  // above this, mush at 28px
const MAX_SUBPATHS = arg('subpaths', 18);
const DENSE_LEN = arg('dense', 1400);

const ALL = process.argv.includes('--all');

/**
 * Two different failure modes, and they are not interchangeable.
 *
 *   ink        -- total path length. Too much and the glyph fills its cell
 *                 with black at 28px.
 *   fragments  -- subpath count. Many disjoint shapes read as noise, but ONLY
 *                 when there is enough ink to make them collide.
 *
 * A flat `subpaths <= 8` cut 70 of 129 beast icons -- `crane` (643 chars, 13
 * subpaths), `trojan-horse`, `crow-nest` -- all of which read perfectly well.
 * Heraldry is beast-heavy, so that rule was throwing away the vocabulary that
 * matters most. Fragmentation only disqualifies a glyph that is also dense.
 */
const legible = (i: { len: number; subpaths: number }): boolean =>
  i.len >= MIN_LEN &&
  i.len <= MAX_LEN &&
  (i.len <= DENSE_LEN || i.subpaths <= MAX_SUBPATHS / 2) &&
  i.subpaths <= MAX_SUBPATHS;

/**
 * Heraldic charge vocabulary. Real heraldry draws from a bounded bestiary --
 * beasts, weapons, celestial bodies, plants, objects of office. Filtering to it
 * is not just taste: a crest built from "hamburger-menu" and "save-arrow" reads
 * as a UI kit, not a coat of arms.
 */
const THEMES: Record<string, readonly string[]> = {
  beasts: ['lion', 'wolf', 'eagle', 'dragon', 'bear', 'stag', 'deer', 'boar', 'raven',
    'crow', 'serpent', 'snake', 'horse', 'fox', 'owl', 'falcon', 'hawk', 'griffin',
    'phoenix', 'unicorn', 'spider', 'scorpion', 'bull', 'ram', 'goat', 'fish',
    'shark', 'whale', 'octopus', 'butterfly', 'bee', 'ant', 'beetle', 'hound', 'dog',
    'cat', 'panther', 'tiger', 'rabbit', 'hare', 'swan', 'crane', 'heron'],
  weapons: ['sword', 'axe', 'spear', 'bow', 'arrow', 'shield', 'helmet', 'helm',
    'hammer', 'dagger', 'mace', 'halberd', 'crossbow', 'lance', 'blade', 'katana',
    'trident', 'scythe', 'sabre', 'saber', 'club', 'flail', 'gauntlet', 'armor',
    'armour', 'cuirass', 'quiver', 'sling'],
  celestial: ['star', 'sun', 'moon', 'crescent', 'comet', 'lightning', 'bolt',
    'eclipse', 'aurora', 'planet', 'orbit', 'constellation', 'galaxy', 'meteor'],
  nature: ['oak', 'leaf', 'tree', 'rose', 'flower', 'acorn', 'wheat', 'mountain',
    'wave', 'flame', 'fire', 'drop', 'water', 'root', 'branch', 'thorn', 'vine',
    'seed', 'mushroom', 'crystal', 'stone', 'rock', 'ice', 'snow', 'cloud', 'storm'],
  objects: ['key', 'crown', 'anchor', 'bell', 'book', 'chalice', 'cup', 'castle',
    'tower', 'gate', 'lantern', 'lamp', 'scroll', 'ring', 'gem', 'diamond',
    'hourglass', 'compass', 'feather', 'quill', 'candle', 'torch', 'chain', 'lock',
    'banner', 'flag', 'horn', 'harp', 'anvil', 'forge', 'wheel', 'ship', 'sail',
    'bridge', 'well', 'coin', 'scales', 'mask', 'skull', 'bone', 'heart', 'eye',
    'hand', 'wing', 'claw', 'fang', 'tooth'],
};

// --- extraction ------------------------------------------------------------

const BG_RECT = /<path d="M0 0h512v512H0z"\s*\/>/;
const D_ATTR = /\sd="([^"]+)"/;

interface Icon {
  author: string;
  name: string;
  d: string;
  len: number;
  subpaths: number;
  theme: string | null;
}

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (p.endsWith('.svg')) out.push(p);
  }
  return out;
}

/**
 * Terms that defeat the vocabulary. Substring matching was the first attempt
 * and it produced a UI kit: `gate` matched `logic-gate-nxor`, `ring` matched
 * `boxing-ring`, `hand` matched `door-handle`, `flag` matched `brazil-flag`.
 * Token matching fixes most of it; these kill the rest -- names that are
 * heraldic word-by-word but anachronistic or generic as a whole.
 */
const DENY = new Set([
  'logic', 'brazil', 'india', 'usa', 'uk', 'steering', 'truck', 'saw', 'golf',
  'boxing', 'card', 'domino', 'bed', 'mooring', 'bollard', 'suspension',
  'handle', 'picking', 'rotation', 'clockwise', 'counterclockwise', 'objective',
  'beats', 'plus', 'minus', 'button', 'menu', 'toggle', 'checkbox', 'cursor',
  'aerodynamic', 'abstract', 'diamonds', 'hearts', 'spades', 'clubs',
]);

/**
 * Match on whole tokens, not substrings. `bat-wing` is two tokens; `hand-truck`
 * is rejected by DENY even though `hand` is in the vocabulary.
 */
function themeOf(name: string): string | null {
  const tokens = name.split('-');
  if (tokens.some((t) => DENY.has(t))) return null;
  for (const [theme, words] of Object.entries(THEMES)) {
    if (tokens.some((t) => words.includes(t) || words.includes(t.replace(/s$/, '')))) {
      return theme;
    }
  }
  return null;
}

function load(root: string): Icon[] {
  const icons: Icon[] = [];
  for (const file of walk(root)) {
    if (file.includes('/badges/')) continue;      // not charges
    const raw = readFileSync(file, 'utf8');
    const d = D_ATTR.exec(raw.replace(BG_RECT, ''))?.[1];
    if (!d) continue;
    const name = basename(file, '.svg');
    icons.push({
      author: basename(dirname(file)),
      name,
      d,
      len: d.length,
      subpaths: (d.match(/[Mm]/g) ?? []).length,
      theme: themeOf(name),
    });
  }
  return icons;
}

// --- page ------------------------------------------------------------------

const esc = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');

function tile(i: Icon): string {
  // The judgement is "does the 28px read", so 28px gets the visual weight.
  // 18px is the cadency-mark test. 64px is a reference for when 28px is
  // ambiguous -- dimmed, and only fully visible on hover, because an eye drawn
  // to the 64px is an eye not doing the actual job.
  const svg = (px: number) =>
    `<svg viewBox="0 0 512 512" width="${px}" height="${px}" aria-hidden="true">` +
    `<path fill="currentColor" d="${esc(i.d)}"/></svg>`;
  return `<label class="t" data-id="${esc(i.author)}/${esc(i.name)}" data-len="${i.len}" data-theme="${i.theme ?? 'other'}">
  <input type="checkbox" checked>
  <span class="row"><span class="dk">${svg(28)}</span><span class="lt">${svg(28)}</span><span class="dk sm">${svg(18)}</span><span class="dk big">${svg(44)}</span></span>
  <span class="meta"><b>${esc(i.name)}</b><i>${esc(i.author)} · ${i.len}c · ${i.subpaths}sp</i></span>
</label>`;
}

function page(icons: Icon[], stats: Record<string, number>): string {
  const byTheme = new Map<string, Icon[]>();
  for (const i of icons) {
    const k = i.theme ?? 'other';
    (byTheme.get(k) ?? byTheme.set(k, []).get(k)!).push(i);
  }
  const sections = [...byTheme.entries()]
    .sort((a, b) => b[1].length - a[1].length)
    .map(([theme, list]) =>
      `<section><h2>${theme} <em>${list.length}</em></h2><div class="grid">${
        list.sort((a, b) => a.len - b.len).map(tile).join('')
      }</div></section>`).join('');

  return `<!doctype html><meta charset="utf-8"><title>Questlog — charge contact sheet</title>
<style>
  :root { --bg:#0A0D14; --fg:#C6D4FF; --win:#16215C; --edge:#6B8CE0; --accent:#FFD866; }
  * { box-sizing:border-box }
  body { margin:0; background:var(--bg); color:var(--fg);
         font:13px/1.4 ui-monospace, monospace; }
  header { position:sticky; top:0; z-index:9; background:var(--win);
           border-bottom:2px solid #fff; padding:10px 16px;
           display:flex; gap:16px; align-items:center; flex-wrap:wrap }
  header b { color:#fff }
  button, input[type=range] { font:inherit }
  button { background:var(--win); color:#fff; border:2px solid #fff;
           padding:4px 10px; cursor:pointer }
  button:hover { background:#25317A }
  #count { color:var(--accent) }
  #fallback { flex-basis:100%; background:#0A0D14; color:var(--fg);
              border:2px solid var(--accent); font:11px/1.3 ui-monospace,monospace;
              padding:6px }
  section { padding:8px 16px 24px }
  h2 { color:#fff; font-size:14px; letter-spacing:.08em; text-transform:uppercase;
       border-bottom:1px solid var(--edge); padding-bottom:6px; margin:18px 0 10px }
  h2 em { color:var(--edge); font-style:normal }
  .grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(148px,1fr)); gap:6px }
  .t { display:block; border:1px solid #25317A; padding:6px; cursor:pointer;
       background:#101736 }
  .t input { display:none }
  .t:has(input:not(:checked)) { opacity:.22; border-color:#333 }
  .t:has(input:not(:checked)) .meta b { text-decoration:line-through }
  .row { display:flex; align-items:center; gap:8px; justify-content:center;
         min-height:60px }
  .dk { color:#fff }
  .sm { opacity:.75 }
  .big { opacity:.3; transition:opacity .1s }
  .t:hover .big { opacity:1 }
  .lt { color:#16215C; background:#C6D4FF; padding:2px; display:inline-flex }
  .meta { display:block; margin-top:4px; overflow:hidden; text-overflow:ellipsis;
          white-space:nowrap }
  .meta b { color:#fff; font-weight:400 }
  .meta i { display:block; color:#5b6ba8; font-style:normal; font-size:11px }
  body.hide-rejected .t:has(input:not(:checked)) { display:none }
</style>
<header>
  <b>charge contact sheet</b>
  <span>judge the two 28px cells · hover for the 44px reference</span>
  <span id="count"></span>
  <button id="hide">hide rejected</button>
  <button id="none">reject all</button>
  <button id="all">keep all</button>
  <button id="copy">copy selection JSON</button>
  <textarea id="fallback" hidden readonly rows="4"
            aria-label="selection JSON, copy manually"></textarea>
  <span>${Object.entries(stats).map(([k, v]) => `${k}: ${v}`).join(' · ')}</span>
</header>
${sections}
<script>
const KEY = 'questlog.charges';
const boxes = [...document.querySelectorAll('.t input')];
const idOf = b => b.closest('.t').dataset.id;
const saved = JSON.parse(localStorage.getItem(KEY) || 'null');
if (saved) { const keep = new Set(saved); boxes.forEach(b => b.checked = keep.has(idOf(b))); }
const count = () => {
  const n = boxes.filter(b => b.checked).length;
  document.getElementById('count').textContent = n + ' kept / ' + boxes.length + ' (target 192)';
};
const save = () => {
  localStorage.setItem(KEY, JSON.stringify(boxes.filter(b => b.checked).map(idOf)));
  count();
};
boxes.forEach(b => b.addEventListener('change', save));
document.getElementById('hide').onclick = () => document.body.classList.toggle('hide-rejected');
document.getElementById('none').onclick = () => { boxes.forEach(b => b.checked = false); save(); };
document.getElementById('all').onclick = () => { boxes.forEach(b => b.checked = true); save(); };
document.getElementById('copy').onclick = async () => {
  const keep = boxes.filter(b => b.checked).map(idOf).sort();
  const json = JSON.stringify({ version: 1, size: keep.length, items: keep }, null, 2);
  const btn = document.getElementById('copy');
  try {
    await navigator.clipboard.writeText(json);
    btn.textContent = 'copied ' + keep.length;
    setTimeout(() => { btn.textContent = 'copy selection JSON'; }, 2000);
  } catch (e) {
    // The clipboard API needs focus and permission and quietly rejects without
    // both. This is the only way the selection leaves the page, so never let it
    // fail silently -- fall back to a selected textarea the user can copy.
    const ta = document.getElementById('fallback');
    ta.value = json;
    ta.hidden = false;
    ta.focus();
    ta.select();
    btn.textContent = 'clipboard blocked — copy below';
  }
};
count();
</script>`;
}

// --- main ------------------------------------------------------------------

if (!existsSync(ICONS_ROOT)) {
  console.error(
    `No icon checkout at ${ICONS_ROOT}\n\n` +
    '  npm run icons     # clone game-icons.net into vendor/ (~4MB, once)\n' +
    '  npm run sheet\n\n' +
    'Or point GAME_ICONS at an existing checkout.',
  );
  process.exit(1);
}

const all = load(ICONS_ROOT);
const passing = all.filter(legible);
const candidates = ALL ? passing : passing.filter((i) => i.theme !== null);

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, page(candidates, {
  scanned: all.length,
  legible: passing.length,
  shown: candidates.length,
}));

console.log(`scanned   ${all.length}`);
console.log(`legible   ${passing.length}  (${MIN_LEN}-${MAX_LEN} chars; <=${MAX_SUBPATHS} subpaths, <=${MAX_SUBPATHS / 2} above ${DENSE_LEN})`);
console.log(`shown     ${candidates.length}${ALL ? '' : '  (heraldic themes only)'}`);
console.log(`-> ${OUT}`);
