import assert from 'node:assert/strict';
import { test } from 'node:test';
import http from 'node:http';
import https from 'node:https';
import net from 'node:net';
import tls from 'node:tls';
import { syncBuiltinESMExports } from 'node:module';

test('generation succeeds when network entry points are forbidden', async (t) => {
  let attempts = 0;
  const deny = () => {
    attempts += 1;
    throw new Error('Network is forbidden in fixture generation');
  };
  const restores = [];
  for (const [owner, key] of [
    [globalThis, 'fetch'],
    [http, 'request'],
    [http, 'get'],
    [https, 'request'],
    [https, 'get'],
    [net, 'connect'],
    [tls, 'connect'],
  ]) {
    const original = owner[key];
    owner[key] = deny;
    restores.push(() => {
      owner[key] = original;
    });
  }
  syncBuiltinESMExports();
  t.after(() => {
    restores.forEach((restore) => restore());
    syncBuiltinESMExports();
  });
  const { buildProtocolFixtures } = await import('../../scripts/protocol-fixtures.mjs');
  const corpus = await buildProtocolFixtures();
  assert.equal(corpus.cases.length, 11);
  assert.equal(attempts, 0);
});
