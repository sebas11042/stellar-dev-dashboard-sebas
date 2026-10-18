import { Account, Address, Asset, Keypair, Memo, Networks, Operation, TransactionBuilder, xdr } from '@stellar/stellar-sdk';
import type { SigningRequest } from '../../src/lib/wallet/signingPayloadTypes';

// Fixed public examples; these seeds are test-only and never fund accounts.
export const signingAccount = Keypair.fromRawEd25519Seed(Buffer.alloc(32, 11));
export const signingRecipient = Keypair.fromRawEd25519Seed(Buffer.alloc(32, 12));
export const signingContract = Address.contract(Buffer.alloc(32, 13)).toString();
export const signingPassphrase = Networks.TESTNET;

export function signingTransaction() {
  return new TransactionBuilder(new Account(signingAccount.publicKey(), '9007199254740993'), {
    fee: '100', networkPassphrase: signingPassphrase,
  }).addOperation(Operation.payment({ destination: signingRecipient.publicKey(), asset: new Asset('USD', signingRecipient.publicKey()), amount: '900719925.1234567' }))
    .addMemo(Memo.text('invoice 42')).setTimeout(300).build();
}

export function signingRequest(payload = signingTransaction().toXDR()): SigningRequest {
  return { kind: 'transaction', payload, signer: signingAccount.publicKey(), networkPassphrase: signingPassphrase };
}

export function signingInvocation(method = 'transfer', children: xdr.SorobanAuthorizedInvocation[] = []) {
  return new xdr.SorobanAuthorizedInvocation({
    function: xdr.SorobanAuthorizedFunction.sorobanAuthorizedFunctionTypeContractFn(new xdr.InvokeContractArgs({
      contractAddress: Address.fromString(signingContract).toScAddress(), functionName: method,
      args: [xdr.ScVal.scvI128(new xdr.Int128Parts({ hi: 0n, lo: 9007199254740993n }))],
    })),
    subInvocations: children,
  });
}

export function signingAuthorization() {
  return new xdr.SorobanAuthorizationEntry({
    credentials: xdr.SorobanCredentials.sorobanCredentialsAddress(new xdr.SorobanAddressCredentials({
      address: Address.fromString(signingAccount.publicKey()).toScAddress(), nonce: 9007199254740993n,
      signatureExpirationLedger: 4294967295, signature: xdr.ScVal.scvVoid(),
    })),
    rootInvocation: signingInvocation('transfer', [signingInvocation('approve')]),
  }).toXDR('base64');
}
