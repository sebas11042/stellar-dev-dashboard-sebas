import { describe, it, expect } from 'vitest';
import { rpc } from '@stellar/stellar-sdk';
import corpus from '../__factories__/protocol-fixtures.generated.json';
import { classifySimulationResponse } from '../../src/lib/stellar/simulationOutcome';
import {
  createSorobanFixtureFactory,
  FIXTURE_PROTOCOL_VERSION,
} from '../__factories__/sorobanContractFixtures';

describe('provenance-tracked protocol corpus', () => {
  const expected = {
    success: 'success',
    cpu_limit: 'success',
    cpu_over_limit: 'resource_exhaustion',
    memory_limit: 'success',
    memory_over_limit: 'resource_exhaustion',
    auth_failure: 'auth_failure',
    resource_exhaustion: 'resource_exhaustion',
    restore_required: 'restore_required',
    rpc_error: 'rpc_error',
  };

  it.each(Object.entries(expected))('%s retains its application behavior', (name, kind) => {
    const entry = corpus.cases.find((item) => item.name === name);
    expect(entry).toBeDefined();
    const outcome = classifySimulationResponse(entry!.response);
    expect(outcome.kind).toBe(kind);
    if (name === 'cpu_limit' || name === 'memory_limit') expect(outcome.warnings).toHaveLength(1);
  });

  it.each(['success', 'cpu_limit', 'memory_limit', 'restore_required'])(
    '%s is real SDK-decodable XDR',
    (name) => {
      const entry = corpus.cases.find((item) => item.name === name)!;
      const parsed = rpc.parseRawSimulation(
        entry.response.result as unknown as rpc.Api.RawSimulateTransactionResponse
      );
      expect(
        name === 'restore_required'
          ? rpc.Api.isSimulationRestore(parsed)
          : rpc.Api.isSimulationSuccess(parsed)
      ).toBe(true);
    }
  );

  it('tracks the shared factory and the modeled protocol', () => {
    expect(corpus.provenance.protocolVersion).toBe(FIXTURE_PROTOCOL_VERSION);
    const factory = createSorobanFixtureFactory(corpus.provenance);
    expect(corpus.cases.find((entry) => entry.name === 'success')!.response).toEqual(
      factory.simulationSuccess()
    );
    for (const name of ['network', 'ledger']) {
      expect(corpus.cases.find((entry) => entry.name === name)!.response.result).toMatchObject({
        protocolVersion: FIXTURE_PROTOCOL_VERSION,
      });
    }
  });
});
