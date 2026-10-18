// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
vi.unmock('@stellar/stellar-sdk');
import { xdr } from '@stellar/stellar-sdk';
import { summarizeSigningPayload } from '../../../src/lib/wallet/signingPayload';
import {
  signingAuthorization,
  signingContract,
  signingInvocation,
  signingRequest,
} from '../../__factories__/signingPayloads';

describe('Soroban authorization review', () => {
  it('shows signer, nonce, expiry, contract, method, exact arguments and nested calls', () => {
    const summary = summarizeSigningPayload({
      ...signingRequest(signingAuthorization()),
      kind: 'authorization',
    });
    const content = JSON.stringify(summary.fields);
    expect(summary.title).toBe('Review Soroban authorization');
    for (const value of [
      signingContract,
      '9007199254740993',
      '4294967295',
      'transfer',
      'approve',
    ]) {
      expect(content).toContain(value);
    }
  });

  it('supports source-account credentials without inventing nonce or expiry', () => {
    const payload = new xdr.SorobanAuthorizationEntry({
      credentials: xdr.SorobanCredentials.sorobanCredentialsSourceAccount(),
      rootInvocation: signingInvocation(),
    }).toXDR('base64');
    const summary = summarizeSigningPayload({ ...signingRequest(payload), kind: 'authorization' });
    expect(JSON.stringify(summary.fields.credentials)).toContain('sorobanCredentialsSourceAccount');
    expect(JSON.stringify(summary.fields.credentials)).not.toContain('nonce');
  });

  it('refuses to decode a transaction as an authorization', () => {
    expect(() => summarizeSigningPayload({ ...signingRequest(), kind: 'authorization' })).toThrow();
  });
});
