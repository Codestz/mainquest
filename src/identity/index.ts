/**
 * The identity layer's public surface.
 *
 * Split from a single 412-line file that held six responsibilities. Consumers
 * import from here; the internals are free to move.
 */
export * from './seed.js';
export * from './tables.js';
export * from './policy.js';
export * from './curation.js';
export * from './flourish.js';
