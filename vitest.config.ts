import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globalSetup: ['test/global-setup.ts'],
    // Test files share one database and Redis and reset them before each test.
    fileParallelism: false,
  },
});
