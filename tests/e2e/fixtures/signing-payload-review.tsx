import { createRoot } from 'react-dom/client';
import { useState } from 'react';
import { TransactionBuilder } from '@stellar/stellar-sdk';
import { presentSigningReview } from '../../../src/components/security/presentSigningReview';
import { executeSigningReview } from '../../../src/lib/wallet/signingReviewGate';
import type { SigningRequest } from '../../../src/lib/wallet/signingPayloadTypes';
import {
  signingAuthorization,
  signingPassphrase,
  signingRecipient,
  signingRequest,
  signingTransaction,
} from '../../__factories__/signingPayloads';

let contextCurrent = true;
window.addEventListener('invalidate-signing-fixture', () => {
  contextCurrent = false;
});

function Fixture() {
  const [result, setResult] = useState('Ready');
  const [signatures, setSignatures] = useState(0);
  async function start(kind: string) {
    contextCurrent = true;
    let request: SigningRequest;
    if (kind === 'authorization')
      request = { ...signingRequest(signingAuthorization()), kind: 'authorization' };
    else if (kind === 'message')
      request = {
        ...signingRequest('Log in to dashboard.example\nNo funds are transferred.'),
        kind: 'message',
        origin: window.location.origin,
        networkPassphrase: undefined,
      };
    else if (kind === 'fee-bump')
      request = signingRequest(
        TransactionBuilder.buildFeeBumpTransaction(
          signingRecipient.publicKey(),
          '200',
          signingTransaction(),
          signingPassphrase
        ).toXDR()
      );
    else request = signingRequest(kind === 'invalid' ? 'not XDR' : undefined);
    try {
      await executeSigningReview(
        request,
        presentSigningReview,
        () => contextCurrent,
        async () => {
          setSignatures((value) => value + 1);
          return 'signed';
        }
      );
      setResult('Signed');
    } catch (error) {
      setResult(error instanceof Error ? error.message : 'Review failed');
    }
  }
  return (
    <>
      <h1>Signing review browser fixture</h1>
      {['transaction', 'fee-bump', 'authorization', 'message', 'invalid'].map((kind) => (
        <button key={kind} type="button" onClick={() => void start(kind)}>
          Review {kind}
        </button>
      ))}
      <p role="status">{result}</p>
      <p>
        Signature calls: <span data-testid="signature-count">{signatures}</span>
      </p>
    </>
  );
}
createRoot(document.getElementById('signing-fixture')!).render(<Fixture />);
