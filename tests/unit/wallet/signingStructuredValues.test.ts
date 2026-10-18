// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
vi.unmock('@stellar/stellar-sdk');
import { Address, Asset, Operation, TransactionBuilder, Account, xdr } from '@stellar/stellar-sdk';
import { readableValue } from '../../../src/lib/wallet/readableSigningValue';
import { summarizeSigningPayload } from '../../../src/lib/wallet/signingPayload';
import {
  signingAccount,
  signingContract,
  signingPassphrase,
  signingRecipient,
  signingRequest,
} from '../../__factories__/signingPayloads';

describe('complete structured signing details', () => {
  it('preserves duplicate SCMap entries rather than collapsing them into object keys', () => {
    const value = xdr.ScVal.scvMap([
      new xdr.ScMapEntry({ key: xdr.ScVal.scvSymbol('scope'), val: xdr.ScVal.scvString('read') }),
      new xdr.ScMapEntry({ key: xdr.ScVal.scvSymbol('scope'), val: xdr.ScVal.scvString('write') }),
    ]);
    const text = JSON.stringify(readableValue(value));
    expect(text).toContain('read');
    expect(text).toContain('write');
    expect(text.match(/scope/g)).toHaveLength(2);
  });

  it('shows vector values, addresses, void and binary contract data', () => {
    const value = xdr.ScVal.scvVec([
      xdr.ScVal.scvAddress(Address.fromString(signingContract).toScAddress()),
      xdr.ScVal.scvVoid(),
      xdr.ScVal.scvBytes(Buffer.from([0, 255])),
    ]);
    const text = JSON.stringify(readableValue(value));
    expect(text).toContain(signingContract);
    expect(text).toContain('scvVoid');
    expect(text).toContain('00ff');
  });

  it('renders non-payment operations and Soroban invocation arguments without network lookups', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(() => {
      throw new Error('Network forbidden');
    });
    try {
      const tx = new TransactionBuilder(new Account(signingAccount.publicKey(), '0'), {
        fee: '100',
        networkPassphrase: signingPassphrase,
      })
        .addOperation(
          Operation.setOptions({
            masterWeight: 0,
            signer: { ed25519PublicKey: signingRecipient.publicKey(), weight: 1 },
          })
        )
        .addOperation(
          Operation.manageSellOffer({
            selling: Asset.native(),
            buying: new Asset('USD', signingRecipient.publicKey()),
            amount: '1.0000001',
            price: { n: 1, d: 3 },
            offerId: '9007199254740993',
          })
        )
        .addOperation(
          Operation.invokeContractFunction({
            contract: signingContract,
            function: 'transfer',
            args: [xdr.ScVal.scvI64(9007199254740993n)],
          })
        )
        .setTimeout(0)
        .build();
      const text = JSON.stringify(summarizeSigningPayload(signingRequest(tx.toXDR())).fields);
      expect(text).toContain('master Weight');
      expect(text).toContain(signingRecipient.publicKey());
      expect(text).toContain('9007199254740993');
      expect(text).toContain(signingContract);
      expect(text).toContain('transfer');
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      fetchSpy.mockRestore();
    }
  });

  it('refuses extra bytes after a valid XDR envelope', () => {
    const payload = Buffer.concat([
      Buffer.from(signingRequest().payload, 'base64'),
      Buffer.from([0, 0, 0, 0]),
    ]).toString('base64');
    expect(() => summarizeSigningPayload(signingRequest(payload))).toThrow();
  });
});
