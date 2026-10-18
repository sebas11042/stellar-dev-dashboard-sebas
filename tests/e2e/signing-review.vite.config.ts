import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Component browser harness only. The normal application build and its CI
// checks remain independent requirements; this never substitutes for them.
export default defineConfig({
  plugins: [react()],
  cacheDir: 'node_modules/.vite-signing-review',
  optimizeDeps: { entries: ['tests/e2e/fixtures/signing-payload-review.html'] },
  build: {
    outDir: 'reports/1192/browser-build',
    emptyOutDir: false,
    rollupOptions: { input: 'tests/e2e/fixtures/signing-payload-review.html' },
  },
});
