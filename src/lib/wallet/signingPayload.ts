import { StrKey, hash, xdr } from '@stellar/stellar-sdk';
import { authorizationSigningDetails } from './authorizationSigningDetails';
import { transactionSigningDetails } from './transactionSigningDetails';
import { signingBytesToHex, visibleText } from './readableSigningValue';
import { SIGNING_LIMITS, type SigningRequest, type SigningSummary } from './signingPayloadTypes';

/** Pure/offline: parsing must never simulate, resolve addresses or fetch ABIs. */
export function summarizeSigningPayload(request: SigningRequest): SigningSummary {
  if (!request || !['transaction', 'authorization', 'message'].includes(request.kind)) {
    throw new Error('Unsupported signing payload type.');
  }
  if (typeof request.payload !== 'string' || !request.payload.length) {
    throw new Error('Signing payload is required.');
  }
  if (!StrKey.isValidEd25519PublicKey(request.signer))
    throw new Error('A valid signer account is required.');
  const limit =
    request.kind === 'message' ? SIGNING_LIMITS.messageBytes : SIGNING_LIMITS.payloadBytes;
  if (request.payload.length > limit)
    throw new Error('Signing payload exceeds the safe review limit.');
  const bytes = new TextEncoder().encode(request.payload);
  if (bytes.length > limit) throw new Error('Signing payload exceeds the safe review limit.');
  if (new TextDecoder('utf-8', { ignoreBOM: true }).decode(bytes) !== request.payload)
    throw new Error('Signing payload contains invalid Unicode.');
  if (request.kind !== 'message') {
    if (typeof request.networkPassphrase !== 'string' || !request.networkPassphrase.trim()) {
      throw new Error('An explicit network passphrase is required.');
    }
    if (btoa(atob(request.payload)) !== request.payload)
      throw new Error('Signing XDR must use canonical base64.');
    // Do not allow trailing bytes ignored by an XDR decoder.
    const parsed =
      request.kind === 'authorization'
        ? xdr.SorobanAuthorizationEntry.fromXDR(request.payload, 'base64')
        : xdr.TransactionEnvelope.fromXDR(request.payload, 'base64');
    if (parsed.toXDR('base64') !== request.payload)
      throw new Error('Signing XDR contains unreviewable data.');
  }
  let details: Pick<SigningSummary, 'title' | 'fields'>;
  const warnings: string[] = [];
  if (request.kind === 'transaction') {
    details = transactionSigningDetails(request.payload, request.networkPassphrase!);
    warnings.push(
      'Review every operation. A readable request does not establish that its recipients or contracts are trustworthy.'
    );
  } else if (request.kind === 'authorization') {
    details = authorizationSigningDetails(request.payload);
    warnings.push(
      'This authorizes the entire invocation tree, including nested calls. Ledger expiry is not a wall-clock time.'
    );
  } else {
    if (!request.origin) throw new Error('A requesting origin is required for message signing.');
    const origin = new URL(request.origin);
    if (!['https:', 'http:'].includes(origin.protocol) || origin.origin !== request.origin) {
      throw new Error('Message origin must be an HTTP(S) origin.');
    }
    details = {
      title: 'Review message signature',
      fields: {
        'requesting origin': request.origin,
        'message (exact text; controls escaped)': visibleText(request.payload),
        'UTF-8 bytes': String(bytes.length),
      },
    };
    warnings.push(
      'A message signature may authenticate you or grant permissions. It is not a transaction and is not network-bound. The origin label is context, not proof of the message author.'
    );
  }
  // A fingerprint binds type, raw payload, account, network and origin. It is
  // diagnostic integrity information, not a signature or a trust endorsement.
  const fingerprint = signingBytesToHex(
    hash(
      new TextEncoder().encode(
        JSON.stringify([
          request.kind,
          request.payload,
          request.signer,
          request.networkPassphrase ?? null,
          request.origin ?? null,
        ])
      )
    )
  );
  return {
    ...details,
    fingerprint,
    fields: {
      signer: request.signer,
      network:
        request.kind === 'message'
          ? 'Network independent'
          : visibleText(request.networkPassphrase!),
      ...details.fields,
    },
    warnings,
  };
}
