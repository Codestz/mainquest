/**
 * Regenerate the sample cards embedded in the README.
 *
 *   npm run samples
 *
 * These are committed, not rendered on the fly, because a README image has to
 * be stable: pointing the docs at a live card from someone's profile means the
 * documentation changes every time that person pushes, and goes stale the day
 * they stop.
 *
 * The source is the `heavy-committer` fixture — synthetic data, so no real
 * account's activity is published here, and deterministic, so this script
 * produces byte-identical output on any day. CI re-runs it and fails if the
 * committed files differ, the same way it checks the action bundle.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { FIXTURES, FIXTURE_DAY } from '../src/fixtures.js';
import { normalise } from '../src/normalise.js';
import { renderAll } from '../src/render/outputs.js';

const FIXTURE = 'heavy-committer';
const CAMPAIGN = 2026;
const OUT = 'assets';
/**
 * The six the README embeds. The still pair is not dead weight: the README's
 * <picture> block serves it to `prefers-reduced-motion`, and documentation
 * that shows a pattern it does not itself use is documentation nobody trusts.
 */
const WANTED = new Set([
  'card-dark.svg', 'card-light.svg',
  'card-dark-still.svg', 'card-light-still.svg',
  'abilities-dark.svg', 'abilities-light.svg',
]);

const f = FIXTURES.find((x) => x.login === FIXTURE);
if (!f) throw new Error(`fixture ${FIXTURE} not found`);

mkdirSync(OUT, { recursive: true });

const outputs = renderAll({
  login: f.login,
  campaign: CAMPAIGN,
  p: normalise(f.raw),
  raw: f.raw,
  weeks: f.weeks,
  restricted: f.restricted,
  accountAgeYears: f.accountAgeYears,
  prsOpened: f.prsOpened,
  campaignDay: FIXTURE_DAY,
  calendarTotal: f.weeks.reduce((a, b) => a + b, 0) + f.restricted,
});

for (const o of outputs.filter((o) => WANTED.has(o.file))) {
  const path = `${OUT}/sample-${o.file}`;
  writeFileSync(path, o.card.svg);
  console.log(`  ${path.padEnd(34)} ${(o.card.svg.length / 1024).toFixed(1)} KB`);
}
console.log(`sample cards regenerated from the ${FIXTURE} fixture, day ${FIXTURE_DAY}`);
