/**
 * Flourish: rarity as luck, never as merit. See the note below — the framing
 * is the design, not decoration.
 */
import { streamForAxis } from './policy.js';

// ---------------------------------------------------------------------------
// Flourish — the shiny
// ---------------------------------------------------------------------------
//
// Rarity, done the one way that does not break the thesis.
//
// The seed is hash(public login). Nobody EARNED it, so a rarity tier presented
// as achievement would be a lie wearing a badge — on a card whose whole pitch
// is that it tells the truth, including the debuffs. It would also invent a
// hierarchy between users based on nothing.
//
// The honest frame is the shiny Pokémon: nobody thinks a shiny means you are
// good at the game. It means you got lucky. That is fun BECAUSE it is not
// merit. So the rules are:
//
//   - never achievement language ("legendary", "elite", "rank")
//   - never adjacent to a `mide:` line, where it could be read as measurement
//   - visually unlike the tier pips, which ARE earned
//
// It is deliberately NOT part of SIGIL_DIMENSIONS. Those multiply into the
// distinctness space and are uniform; this is a weighted overlay on top of an
// already-chosen crest. Counting a 1-in-100 outcome as "x4 distinctness" would
// overstate the space the collision floor is asserted against.

export type Flourish = 'plain' | 'burnished' | 'gilded' | 'shiny';

/** Weights out of 1000. Tuned so `shiny` stays a genuine surprise. */
export const FLOURISHES: ReadonlyArray<readonly [Flourish, number]> = [
  ['plain', 820],      // 82%
  ['burnished', 140],  // 14%   a metal tincture on the charge
  ['gilded', 35],      // 3.5%  metal charge + a gold inner border
  ['shiny', 5],        // 0.5%  all of the above, plus a slow glint sweep
];

/** Weighted draw. Same lane discipline as everything else on the seed side. */
export function drawFlourish(login: string): Flourish {
  const rnd = streamForAxis(login, 0, 'sigil');
  // Burn one draw so the flourish never correlates with the shield shape,
  // which is the first thing the sigil composer takes from this lane.
  rnd();
  const total = FLOURISHES.reduce((n, [, w]) => n + w, 0);
  let roll = rnd() * total;
  for (const [name, w] of FLOURISHES) {
    roll -= w;
    if (roll <= 0) return name;
  }
  return 'plain';
}
