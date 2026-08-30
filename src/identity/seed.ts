/**
 * Seed derivation: roots, per-axis lanes, PRNG, and the save seal.
 *
 * Part of the identity layer. See src/identity/policy.ts for the rule that
 * governs all of it: seed owns what reads as heraldry, data owns what reads as
 * a chart, and the two never share a visual language.
 */

// ---------------------------------------------------------------------------
// Seed
// ---------------------------------------------------------------------------
//
// What this does and does not give you:
//
//   deterministic  -- guaranteed. Same login + campaign -> same card, forever.
//   distinct       -- probabilistic. 64-bit keeps collisions negligible at any
//                     plausible user count (32-bit did not: ~69% chance of a
//                     collided pair at 100k users).
//   unforgeable    -- NO. The input is a public login, so anyone can compute
//                     anyone's seed and render their card. `seal` proves the
//                     card was *derived* from that login; it proves nothing
//                     about who rendered it. Ownership needs a registry, not a
//                     hash. Do not describe this as minted, owned, or signed.

const FNV64_OFFSET = 0xcbf29ce484222325n;
const FNV64_PRIME = 0x100000001b3n;
const MASK64 = 0xffffffffffffffffn;

function fnv1a64(input: string, init = FNV64_OFFSET): bigint {
  let h = init;
  for (let i = 0; i < input.length; i++) {
    h ^= BigInt(input.charCodeAt(i));
    h = (h * FNV64_PRIME) & MASK64;
  }
  return h;
}

/**
 * The permanent root. Campaign-invariant, so anything drawn from it is yours
 * for as long as the login exists.
 */
export function identitySeed(login: string): bigint {
  return fnv1a64(login.toLowerCase());
}

/** The per-campaign root. Reshuffles every January. */
export function campaignSeed(login: string, campaign: number): bigint {
  return fnv1a64(`${login.toLowerCase()}#${campaign}`);
}

/**
 * A 32-bit lane for one axis, derived from a root seed and the axis name.
 *
 * Why per-axis lanes instead of one shared stream: with a single PRNG, the
 * order of draws is part of the contract. Add one `pick()` to the sigil
 * composer and every draw after it shifts -- so a version bump silently
 * repaints every existing user's palette and accessories. Cards are screenshot
 * and shared; they must not mutate because you shipped a new shield shape.
 * Independent lanes make each axis's stream immune to changes in the others.
 */
export function laneFor(seed: bigint, axis: string): number {
  const h = fnv1a64(axis, seed ^ 0x9e3779b97f4a7c15n);
  return Number((h ^ (h >> 32n)) & 0xffffffffn) >>> 0;
}

/** mulberry32. Same lane -> same stream, forever. */
export function prng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Save-file style mark, rendered bottom-right. Eight base36 characters, so the
 * displayed mark does not become the narrow point -- a 6-char seal is ~2^31 of
 * space and would reintroduce the collision the 64-bit seed just removed.
 *
 * Campaign-scoped: the seal identifies this year's save, not the character.
 * Recomputable by anyone from the login. A checksum, not a signature.
 */
export function seal(seed: bigint): string {
  return (seed & MASK64).toString(36).toUpperCase().padStart(8, '0').slice(-8);
}
