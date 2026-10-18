#!/usr/bin/env node
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { refreshProtocolFixtures } from './protocol-fixtures.mjs';

export async function main(args = process.argv.slice(2)) {
  if (args.length > 1 || args.some((arg) => arg !== '--check')) {
    throw new Error('Usage: node scripts/refresh-protocol-fixtures.mjs [--check]');
  }
  const changed = await refreshProtocolFixtures({ check: args.includes('--check') });
  console.info(changed ? 'Protocol fixtures refreshed.' : 'Protocol fixtures are current.');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(`Protocol fixture refresh failed: ${error.message}`);
    process.exitCode = 1;
  });
}
