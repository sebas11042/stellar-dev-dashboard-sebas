// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
vi.unmock('@stellar/stellar-sdk');
import { summarizeSigningPayload } from '../../../src/lib/wallet/signingPayload';
import { SIGNING_LIMITS, type SigningRequest } from '../../../src/lib/wallet/signingPayloadTypes';
import { signingRequest, signingRecipient } from '../../__factories__/signingPayloads';

describe('readable transaction signing', () => {
  it('shows the complete recipient, issuer, exact amount, memo and sequence', () => {
    const summary = summarizeSigningPayload(signingRequest());
    const content = JSON.stringify(summary.fields);
    expect(summary.title).toBe('Review transaction');
    expect(content).toContain(signingRecipient.publicKey());
    expect(content).toContain('900719925.1234567');
    expect(content).toContain('9007199254740994');
    expect(content).toContain('invoice 42');
    expect(content).toContain('issuer');
    expect(summary.fingerprint).toMatch(/^[a-f0-9]{64}$/);
  });

  it('rejects missing network context rather than falling back to testnet', () => {
    expect(() => summarizeSigningPayload({ ...signingRequest(), networkPassphrase: '' })).toThrow(
      'passphrase'
    );
  });

  it('rejects invalid and noncanonical XDR', () => {
    expect(() => summarizeSigningPayload(signingRequest('invalid'))).toThrow();
    expect(() => summarizeSigningPayload(signingRequest(`${signingRequest().payload}\n`))).toThrow(
      'canonical'
    );
  });

  it('rejects oversized XDR before attempting to decode it', () => {
    expect(() =>
      summarizeSigningPayload(signingRequest('A'.repeat(SIGNING_LIMITS.payloadBytes + 1)))
    ).toThrow('limit');
  });

  it('refuses future payload kinds until their decoder and review are implemented', () => {
    expect(() =>
      summarizeSigningPayload({ ...signingRequest(), kind: 'unknown' } as unknown as SigningRequest)
    ).toThrow('Unsupported');
  });
});
