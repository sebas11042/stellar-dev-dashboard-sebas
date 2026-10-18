// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
vi.unmock('@stellar/stellar-sdk');
import { TransactionBuilder } from '@stellar/stellar-sdk';
import { summarizeSigningPayload } from '../../../src/lib/wallet/signingPayload';
import { signingAccount, signingPassphrase, signingRecipient, signingRequest, signingTransaction } from '../../__factories__/signingPayloads';

describe('fee-bump signing review', () => {
  it('distinguishes the outer fee payer and fee from the inner operations', () => {
    const tx = TransactionBuilder.buildFeeBumpTransaction(signingRecipient.publicKey(), '200', signingTransaction(), signingPassphrase);
    const summary = summarizeSigningPayload(signingRequest(tx.toXDR()));
    expect(summary.title).toBe('Review fee-bump transaction');
    expect(summary.fields['fee payer']).toBe(signingRecipient.publicKey());
    expect(summary.fields['maximum fee (stroops)']).toBe(tx.fee);
    expect(summary.fields['inner transaction']).toMatchObject({ source: signingAccount.publicKey() });
    expect(JSON.stringify(summary.fields)).toContain('900719925.1234567');
  });

  it('binds the fingerprint to the selected network and signer', () => {
    const request = signingRequest();
    const original = summarizeSigningPayload(request).fingerprint;
    expect(summarizeSigningPayload({ ...request, signer: signingRecipient.publicKey() }).fingerprint).not.toBe(original);
    expect(summarizeSigningPayload({ ...request, networkPassphrase: 'another network' }).fingerprint).not.toBe(original);
  });
});
