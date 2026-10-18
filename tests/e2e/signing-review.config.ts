import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  testMatch: 'signing-payload-review.spec.ts',
  timeout: 30_000,
  expect: { timeout: 10_000 },
  use: { baseURL: 'http://localhost:5187', trace: 'retain-on-failure' },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
    { name: 'mobile-chrome', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    command:
      'pnpm exec vite --config tests/e2e/signing-review.vite.config.ts --port 5187 --strictPort',
    url: 'http://localhost:5187/tests/e2e/fixtures/signing-payload-review.html',
    timeout: 30_000,
    reuseExistingServer: false,
  },
});
