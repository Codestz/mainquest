import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    // Determinism rule (docs/01): same input -> byte-identical output.
    // Snapshots are the only practical guard on generated markup.
    snapshotFormat: { escapeString: false },
  },
});
