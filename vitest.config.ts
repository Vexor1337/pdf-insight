import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/unit/**/*.test.ts', 'worker/test/**/*.test.ts'],
    environment: 'node',
    restoreMocks: true,
  },
});
