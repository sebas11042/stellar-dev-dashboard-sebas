import assert from 'node:assert/strict';
import { test } from 'node:test';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { ROOT } from '../../scripts/protocol-fixtures.mjs';

function run(args) {
  return spawnSync(process.execPath, [join(ROOT, 'scripts/refresh-protocol-fixtures.mjs'), ...args], {
    cwd: process.env.TEMP || ROOT,
    encoding: 'utf8',
  });
}

test('CLI checks committed corpus from another working directory', () => {
  const result = run(['--check']);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /current/);
});

test('CLI fails closed on unknown, duplicate or value-taking flags', () => {
  for (const args of [['--network', 'mainnet'], ['--check', '--check'], ['--output=/tmp/corpus'], ['--help']]) {
    const result = run(args);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Usage:/);
  }
});
