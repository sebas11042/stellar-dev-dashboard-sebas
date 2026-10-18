import { defineConfig } from '@playwright/test';
import development from './signing-review.config';

export default defineConfig({
  ...development,
  webServer: {
    command:
      'pnpm exec vite preview --config tests/e2e/signing-review.vite.config.ts --port 5187 --strictPort',
    url: 'http://localhost:5187/tests/e2e/fixtures/signing-payload-review.html',
    timeout: 30_000,
    reuseExistingServer: false,
  },
});
