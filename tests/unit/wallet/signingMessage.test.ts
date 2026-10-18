// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
vi.unmock('@stellar/stellar-sdk');
import { summarizeSigningPayload } from '../../../src/lib/wallet/signingPayload';
import { readableValue } from '../../../src/lib/wallet/readableSigningValue';
import { SIGNING_LIMITS, type SigningRequest } from '../../../src/lib/wallet/signingPayloadTypes';
import { signingAccount } from '../../__factories__/signingPayloads';

const message = (payload: string): SigningRequest => ({
  kind: 'message',
  payload,
  signer: signingAccount.publicKey(),
  origin: 'https://dashboard.example',
});

describe('message signing review', () => {
  it('shows exact text, requesting origin and visible controls without executing markup', () => {
    const summary = summarizeSigningPayload(message('<script>sign()</script>\nA\u202eB'));
    expect(summary.fields['message (exact text; controls escaped)']).toBe(
      '<script>sign()</script>\\u000aA\\u202eB'
    );
    expect(summary.fields['requesting origin']).toBe('https://dashboard.example');
    expect(summary.fields.network).toBe('Network independent');
  });

  it('accepts the UTF-8 byte limit and rejects one byte over', () => {
    expect(() =>
      summarizeSigningPayload(message('é'.repeat(SIGNING_LIMITS.messageBytes / 2)))
    ).not.toThrow();
    expect(() =>
      summarizeSigningPayload(message('é'.repeat(SIGNING_LIMITS.messageBytes / 2) + 'x'))
    ).toThrow('limit');
  });

  it.each(['', '\ud800'])('rejects empty or invalid Unicode text %j', (payload) => {
    expect(() => summarizeSigningPayload(message(payload))).toThrow();
  });

  it('rejects missing or misleading origin labels', () => {
    expect(() => summarizeSigningPayload({ ...message('login'), origin: undefined })).toThrow(
      'origin'
    );
    expect(() =>
      summarizeSigningPayload({ ...message('login'), origin: 'https://safe.example@evil.example' })
    ).toThrow('origin');
  });

  it('binds approval identity to message and origin', () => {
    const original = summarizeSigningPayload(message('login')).fingerprint;
    expect(summarizeSigningPayload(message('login ')).fingerprint).not.toBe(original);
    expect(
      summarizeSigningPayload({ ...message('login'), origin: 'https://other.example' }).fingerprint
    ).not.toBe(original);
  });

  it('rejects unreviewable structures and preserves binary and integer precision', () => {
    expect(readableValue(9007199254740993n)).toBe('9007199254740993');
    expect(readableValue(Buffer.from([0, 255]))).toEqual({ encoding: 'hex', bytes: '00ff' });
    expect(() => readableValue(Number.MAX_SAFE_INTEGER + 1)).toThrow('Unsafe');
    const cyclic: unknown[] = [];
    cyclic.push(cyclic);
    expect(() => readableValue(cyclic)).toThrow('Cyclic');
    let deep: unknown = 'leaf';
    for (let index = 0; index < SIGNING_LIMITS.depth + 1; index++) deep = [deep];
    expect(() => readableValue(deep)).toThrow('limit');
  });
});
