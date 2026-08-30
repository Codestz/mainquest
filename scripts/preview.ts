/**
 * The dev loop: render every fixture and lay them out on one page.
 *
 *   npm run preview
 *
 * The five fixtures are the ones docs/01 requires for snapshot tests -- heavy
 * committer, heavy reviewer, brand-new, mostly-private, zero-activity -- so the
 * preview and the test suite look at exactly the same inputs. The empty state
 * is the one everyone forgets, so it is always on screen.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { FIXTURES } from '../src/fixtures.js';
import { normalise } from '../src/normalise.js';
import { renderCard } from '../src/render/card.js';
import { sigilCombinations } from '../src/render/sigil/index.js';

const CAMPAIGN = 2026;
const DAY = Number(process.env['DAY'] ?? 242);

mkdirSync('build/cards', { recursive: true });

const cards = FIXTURES.map((f) => {
  const card = renderCard({
    login: f.login, campaign: CAMPAIGN, p: normalise(f.raw), raw: f.raw,
    weeks: f.weeks, restricted: f.restricted, accountAgeYears: f.accountAgeYears,
    prsOpened: f.prsOpened, campaignDay: DAY,
    calendarTotal: f.weeks.reduce((a, b) => a + b, 0) + f.restricted,
  });
  writeFileSync(`build/cards/${f.login}.svg`, card.svg);
  return { f, card };
});

const page = `<!doctype html><meta charset="utf-8"><title>Questlog — card preview</title>
<style>
 body{margin:0;background:#0A0D14;color:#C6D4FF;font:13px/1.5 ui-monospace,monospace;padding:20px}
 h1{color:#fff;font-size:15px;letter-spacing:.1em;text-transform:uppercase}
 .m{color:#5b6ba8;margin-bottom:24px}
 figure{margin:0 0 28px}
 figcaption{padding:6px 2px;color:#FFD866}
 figcaption i{color:#5b6ba8;font-style:normal}
 img{display:block;border:1px solid #25317A;max-width:100%}
</style>
<h1>card preview · campaign ${CAMPAIGN} · day ${DAY}</h1>
<p class="m">${FIXTURES.length} fixtures · sigil space ${sigilCombinations().toLocaleString()} ·
 set DAY=1 to see the January sky, DAY=360 for December</p>
${cards.map(({ f, card }) => `<figure>
 <img src="cards/${f.login}.svg" width="880" height="420" alt="${f.login}">
 <figcaption>${f.login} — ${card.klass} <i>· ${f.note} · charge: ${card.credit.id}</i></figcaption>
</figure>`).join('\n')}`;

writeFileSync('build/preview.html', page);
console.log(`rendered ${cards.length} cards -> build/preview.html`);
for (const { f, card } of cards) {
  console.log(`  ${f.login.padEnd(16)} ${card.klass.padEnd(12)} ${(card.svg.length / 1024).toFixed(1)}KB  ${card.credit.id}`);
}
