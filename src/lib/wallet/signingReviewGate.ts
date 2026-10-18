import { summarizeSigningPayload } from './signingPayload';
import type { SigningRequest, SigningSummary } from './signingPayloadTypes';

export type SigningPresenter = (summary: SigningSummary) => Promise<boolean>;
let active = false;

/** One explicit approval authorizes exactly one invocation with a frozen request. */
export async function executeSigningReview<T>(
  input: SigningRequest,
  present: SigningPresenter,
  isCurrent: () => boolean | Promise<boolean>,
  sign: (request: Readonly<SigningRequest>) => Promise<T>,
): Promise<T> {
  if (active) throw new Error('Another signing review is already open. Finish or cancel it first.');
  active = true;
  try {
    const request = Object.freeze({ ...input });
    const summary = summarizeSigningPayload(request);
    const expiresAt = Date.now() + 5 * 60 * 1000;
    if (!await isCurrent()) throw new Error('Signing context changed. Start a new review.');
    if (!await present(summary)) throw new Error('Signing review cancelled.');
    if (Date.now() >= expiresAt || !await isCurrent()) {
      throw new Error('Signing review expired or the account/network changed. Start a new review.');
    }
    return await sign(request);
  } finally {
    active = false;
  }
}
