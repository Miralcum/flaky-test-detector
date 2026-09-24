import { defineConfig } from '@playwright/test';

export default defineConfig({
  timeout: 10_000,
  retries: 0,
  fullyParallel: true,
  reporter: [
    ['list'],
    ['./reporters/flaky-reporter.ts'],
  ],
  projects: [
    {
      name: 'sinteticos',
      testDir: './tests',
    },
    {
      name: 'e2e',
      testDir: './tests-e2e',
      use: { browserName: 'chromium' },
    },
  ],
});
