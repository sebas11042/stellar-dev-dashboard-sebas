import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { digest, normalizeSource, validateSpec, ROOT } from '../../scripts/protocol-fixtures.mjs';

const spec = JSON.parse(await readFile(new URL('../../tests/__factories__/protocol-fixture-spec.json', import.meta.url), 'utf8'));

test('accepts the committed synthetic specification', () => {
  assert.equal(validateSpec(spec), spec);
  assert.ok(ROOT.endsWith('/') || ROOT.endsWith('\\'));
});

test('hashes are stable across checkout line endings', () => {
  assert.equal(digest(normalizeSource('a\r\nb\r\n')), digest('a\nb\n'));
  assert.notEqual(digest('a'), digest('b'));
});

test('accepts uint32 protocol and ledger boundaries', () => {
  for (const protocolVersion of [1, 0xffffffff]) validateSpec({ ...spec, protocolVersion });
  for (const startLedger of [0, 0xffffffff - 32]) validateSpec({ ...spec, startLedger });
});

test('rejects invalid provenance and dangerous network substitutions', () => {
  const invalid = [null, {}, { ...spec, kind: 'captured' }, { ...spec, schemaVersion: 2 }];
  for (const network of ['mainnet', 'public', 'futurenet', 'https://localhost']) invalid.push({ ...spec, network });
  for (const protocolVersion of [0, -1, 1.5, '22', 0x100000000]) invalid.push({ ...spec, protocolVersion });
  for (const startLedger of [-1, 1.5, '1000', 0xffffffff, Number.MAX_SAFE_INTEGER]) invalid.push({ ...spec, startLedger });
  for (const seed of ['', '   ', null, 42]) invalid.push({ ...spec, seed });
  invalid.push({ ...spec, reference: 'https://localhost/secrets' });
  for (const value of invalid) assert.throws(() => validateSpec(value));
});
