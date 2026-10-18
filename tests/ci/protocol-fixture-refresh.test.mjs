import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, mkdir, readFile, writeFile, copyFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { buildProtocolFixtures, refreshProtocolFixtures, serialize, digest, ROOT, INPUTS, OUTPUT } from '../../scripts/protocol-fixtures.mjs';

async function workspace(t) {
  const root = await mkdtemp(join(tmpdir(), 'protocol-fixtures-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  for (const path of INPUTS) {
    await mkdir(dirname(join(root, path)), { recursive: true });
    await copyFile(join(ROOT, path), join(root, path));
  }
  return root;
}

test('builds byte-identical provenance and independent payload digests', async () => {
  const first = await buildProtocolFixtures();
  assert.equal(serialize(first), serialize(await buildProtocolFixtures()));
  assert.equal(first.provenance.kind, 'synthetic');
  assert.match(first.provenance.sdk.version, /^\d+\.\d+\.\d+/);
  assert.equal(first.provenance.inputs.length, INPUTS.length);
  for (const entry of first.cases) assert.equal(entry.sha256, digest(serialize(entry.response)));
});

test('missing check is read-only; refresh recovers and is idempotent', async (t) => {
  const root = await workspace(t);
  await assert.rejects(refreshProtocolFixtures({ root, check: true }), /missing or stale/);
  await assert.rejects(readFile(join(root, OUTPUT)), { code: 'ENOENT' });
  assert.equal(await refreshProtocolFixtures({ root }), true);
  const before = await readFile(join(root, OUTPUT), 'utf8');
  assert.equal(await refreshProtocolFixtures({ root }), false);
  assert.equal(await refreshProtocolFixtures({ root, check: true }), false);
  assert.equal(await readFile(join(root, OUTPUT), 'utf8'), before);
  assert.equal((await readdir(dirname(join(root, OUTPUT)))).some((name) => name.endsWith('.tmp')), false);
});

test('corrupt corpus is detected without rewriting, then repaired', async (t) => {
  const root = await workspace(t);
  await refreshProtocolFixtures({ root });
  await writeFile(join(root, OUTPUT), '{broken');
  await assert.rejects(refreshProtocolFixtures({ root, check: true }), /missing or stale/);
  assert.equal(await readFile(join(root, OUTPUT), 'utf8'), '{broken');
  assert.equal(await refreshProtocolFixtures({ root }), true);
  await refreshProtocolFixtures({ root, check: true });
});

test('source and lockfile changes invalidate provenance', async (t) => {
  const root = await workspace(t);
  await refreshProtocolFixtures({ root });
  for (const path of ['pnpm-lock.yaml', 'src/lib/stellar/simulationOutcome.ts']) {
    const target = join(root, path);
    await writeFile(target, `${await readFile(target, 'utf8')}\n`);
    await assert.rejects(refreshProtocolFixtures({ root, check: true }), /missing or stale/);
    await refreshProtocolFixtures({ root });
  }
});

test('invalid inputs leave the previous corpus untouched', async (t) => {
  const root = await workspace(t);
  await refreshProtocolFixtures({ root });
  const before = await readFile(join(root, OUTPUT), 'utf8');
  const path = join(root, INPUTS[0]);
  const spec = JSON.parse(await readFile(path, 'utf8'));
  await writeFile(path, serialize({ ...spec, protocolVersion: spec.protocolVersion + 1 }));
  await assert.rejects(refreshProtocolFixtures({ root }), /disagree/);
  assert.equal(await readFile(join(root, OUTPUT), 'utf8'), before);
  await writeFile(path, '{broken');
  await assert.rejects(refreshProtocolFixtures({ root }), SyntaxError);
  assert.equal(await readFile(join(root, OUTPUT), 'utf8'), before);
});
