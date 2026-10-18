import { createHash, randomUUID } from 'node:crypto';
import { readFile, rename, unlink, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

export const ROOT = fileURLToPath(new URL('../', import.meta.url));
export const OUTPUT = 'tests/__factories__/protocol-fixtures.generated.json';
export const INPUTS = Object.freeze([
  'tests/__factories__/protocol-fixture-spec.json',
  'tests/__factories__/sorobanContractFixtures.ts',
  'src/lib/stellar/simulationOutcome.ts',
  'scripts/protocol-fixtures.mjs',
  'scripts/refresh-protocol-fixtures.mjs',
  'pnpm-lock.yaml',
]);

export function digest(value) {
  return createHash('sha256').update(value).digest('hex');
}

// Normalize checkout line endings so Windows and Linux produce the same provenance.
export function normalizeSource(value) {
  return value.replace(/\r\n/g, '\n');
}

export function validateSpec(spec) {
  if (!spec || spec.schemaVersion !== 1 || spec.kind !== 'synthetic') {
    throw new Error('Expected schemaVersion 1 and synthetic fixture provenance');
  }
  if (spec.network !== 'testnet') throw new Error('Protocol corpus must use testnet');
  if (!Number.isInteger(spec.protocolVersion) || spec.protocolVersion < 1 || spec.protocolVersion > 0xffffffff) {
    throw new Error('protocolVersion must be a positive uint32');
  }
  if (typeof spec.seed !== 'string' || !spec.seed.trim()) throw new Error('seed must be non-empty');
  if (!Number.isInteger(spec.startLedger) || spec.startLedger < 0 || spec.startLedger > 0xffffffff - 32) {
    throw new Error('startLedger must leave room for the corpus within uint32');
  }
  if (spec.reference !== 'https://github.com/stellar/stellar-protocol/blob/master/core/cap-0046.md') {
    throw new Error('Unexpected protocol reference (references are never fetched)');
  }
  return spec;
}

export function serialize(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

async function sdkVersion() {
  const require = createRequire(import.meta.url);
  let directory = dirname(require.resolve('@stellar/stellar-sdk'));
  for (;;) {
    try {
      const pkg = JSON.parse(await readFile(join(directory, 'package.json'), 'utf8'));
      if (pkg.name === '@stellar/stellar-sdk') return pkg.version;
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
    const parent = dirname(directory);
    if (parent === directory) throw new Error('Cannot locate Stellar SDK package metadata');
    directory = parent;
  }
}

export async function buildProtocolFixtures(root = ROOT) {
  const sources = Object.fromEntries(await Promise.all(INPUTS.map(async (path) => [
    path, normalizeSource(await readFile(join(root, path), 'utf8')),
  ])));
  const spec = validateSpec(JSON.parse(sources[INPUTS[0]]));
  // Execute only the fixed, repository-owned factory. Transpiling in memory avoids
  // temporary executable files and works on Node 22 without experimental flags.
  const factorySource = sources[INPUTS[1]].replace(
    "'@stellar/stellar-sdk'", JSON.stringify(import.meta.resolve('@stellar/stellar-sdk'))
  );
  const compiled = ts.transpileModule(factorySource, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
  }).outputText;
  const { createSorobanFixtureFactory, FIXTURE_PROTOCOL_VERSION, FIXTURE_RESOURCE_LIMITS } =
    await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);
  if (spec.protocolVersion !== FIXTURE_PROTOCOL_VERSION) {
    throw new Error('Protocol spec and Soroban factory disagree; update both before refreshing');
  }
  const factory = createSorobanFixtureFactory(spec);
  const cases = [
    ['success', () => factory.simulationSuccess()],
    ['cpu_limit', () => factory.simulationSuccess({ cpuInsns: FIXTURE_RESOURCE_LIMITS.cpuInstructions })],
    ['cpu_over_limit', () => factory.simulationSuccess({ cpuInsns: FIXTURE_RESOURCE_LIMITS.cpuInstructions + 1 })],
    ['memory_limit', () => factory.simulationSuccess({ memBytes: FIXTURE_RESOURCE_LIMITS.memoryBytes })],
    ['memory_over_limit', () => factory.simulationSuccess({ memBytes: FIXTURE_RESOURCE_LIMITS.memoryBytes + 1 })],
    ['auth_failure', () => factory.authFailure()],
    ['resource_exhaustion', () => factory.resourceExhaustion()],
    ['restore_required', () => factory.restoreRequired()],
    ['rpc_error', () => factory.rpcError()],
    ['network', () => factory.handle({ method: 'getNetwork', id: 'network' })],
    ['ledger', () => factory.handle({ method: 'getLatestLedger', id: 'ledger' })],
  ].map(([name, generate]) => {
    factory.reset();
    const response = generate();
    return { name, sha256: digest(serialize(response)), response };
  });
  return {
    provenance: {
      ...spec,
      generator: 'scripts/refresh-protocol-fixtures.mjs',
      sdk: { name: '@stellar/stellar-sdk', version: await sdkVersion() },
      inputs: Object.entries(sources).map(([path, content]) => ({ path, sha256: digest(content) })),
    },
    cases,
  };
}

export async function refreshProtocolFixtures({ check = false, root = ROOT } = {}) {
  // Build everything before touching the committed corpus.
  const expected = serialize(await buildProtocolFixtures(root));
  const target = join(root, OUTPUT);
  let actual;
  try {
    actual = normalizeSource(await readFile(target, 'utf8'));
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  if (actual === expected) return false;
  if (check) throw new Error('Protocol fixtures missing or stale. Run: pnpm run fixtures:protocol:refresh');
  const temporary = `${target}.${process.pid}.${randomUUID()}.tmp`;
  try {
    await writeFile(temporary, expected, { encoding: 'utf8', flag: 'wx' });
    await rename(temporary, target);
  } finally {
    await unlink(temporary).catch((error) => { if (error.code !== 'ENOENT') throw error; });
  }
  return true;
}
