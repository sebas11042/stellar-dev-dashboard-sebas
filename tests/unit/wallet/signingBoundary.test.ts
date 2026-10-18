// @vitest-environment node
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, it } from 'vitest';

it('application callers use reviewed adapters instead of raw wallet transports', () => {
  const sourceRoot = fileURLToPath(new URL('../../../src/', import.meta.url));
  const violations: string[] = [];
  function inspect(directory: string) {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      if (entry.name === '__tests__' || entry.name === 'node_modules') continue;
      const path = join(directory, entry.name);
      if (entry.isDirectory()) inspect(path);
      else if (/\.[jt]sx?$/.test(entry.name) && !/\.test\./.test(entry.name)) {
        const relative = path.slice(sourceRoot.length).replaceAll('\\', '/');
        if (relative.startsWith('lib/wallet/')) continue; // transport implementations and their reviewed registry
        if (
          /\b(?:signTransactionWith(?:Freighter|XBull|Lobstr|Solar|Ledger)|signXdrWith(?:Ledger|WalletConnect)|signWith(?:SolarSEP7|SEP7))\b/.test(
            readFileSync(path, 'utf8')
          )
        ) {
          violations.push(relative);
        }
      }
    }
  }
  inspect(sourceRoot);
  expect(
    violations,
    'Route wallet signing through getWalletAdapter so every caller receives payload review.'
  ).toEqual([]);
});
