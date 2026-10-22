import { defineConfig } from 'vitest/config';

// Retained deployment snapshots under release/ are evidence, not this project's tests.
export default defineConfig({ test: { include: ['tests/**/*.test.ts'], testTimeout: 15_000 } });
