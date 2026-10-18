/** Only user-facing wallet payloads belong here, not server or issuer keys. */
export type SigningPayloadKind = 'transaction' | 'authorization' | 'message';

export interface SigningRequest {
  kind: SigningPayloadKind;
  payload: string;
  signer: string;
  /** Transactions and authorization entries require an explicit passphrase. */
  networkPassphrase?: string;
  /** Human-readable origin for message signatures (not a verified identity). */
  origin?: string;
}

export type ReadableValue =
  | string
  | boolean
  | null
  | ReadableValue[]
  | {
      [key: string]: ReadableValue;
    };

export interface SigningSummary {
  title: string;
  fingerprint: string;
  fields: { [key: string]: ReadableValue };
  warnings: string[];
}

// Bounds are enforced before decoding and while traversing decoded values.
export const SIGNING_LIMITS = Object.freeze({
  payloadBytes: 256 * 1024,
  messageBytes: 16 * 1024,
  nodes: 20_000,
  depth: 32,
});
