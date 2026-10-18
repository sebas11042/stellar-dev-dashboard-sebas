// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
vi.unmock('@stellar/stellar-sdk');
import { executeSigningReview } from '../../../src/lib/wallet/signingReviewGate';
import { signingRequest } from '../../__factories__/signingPayloads';

afterEach(() => vi.useRealTimers());

describe('signing approval boundary', () => {
  it('signs the frozen payload once and only after explicit approval', async () => {
    const input = signingRequest();
    const original = input.payload;
    const sign = vi.fn(async (request) => request.payload);
    const result = await executeSigningReview(input, async (summary) => {
      expect(summary.title).toBe('Review transaction');
      expect(sign).not.toHaveBeenCalled();
      input.payload = 'mutated while reading';
      return true;
    }, () => true, sign);
    expect(result).toBe(original);
    expect(Object.isFrozen(sign.mock.calls[0][0])).toBe(true);
    expect(sign).toHaveBeenCalledTimes(1);
  });

  it.each([false, true])('never signs on cancellation or changed context (%s)', async (approved) => {
    let current = true;
    const sign = vi.fn();
    await expect(executeSigningReview(signingRequest(), async () => {
      current = false; return approved;
    }, () => current, sign)).rejects.toThrow();
    expect(sign).not.toHaveBeenCalled();
  });

  it('rejects concurrent prompts and recovers after cancellation', async () => {
    let cancel!: (approved: boolean) => void;
    const sign = vi.fn();
    const pending = executeSigningReview(signingRequest(), () => new Promise((resolve) => { cancel = resolve; }), () => true, sign);
    await Promise.resolve();
    await expect(executeSigningReview(signingRequest(), async () => true, () => true, sign)).rejects.toThrow('already open');
    cancel(false);
    await expect(pending).rejects.toThrow('cancelled');
    await expect(executeSigningReview(signingRequest(), async () => true, () => true, async () => 'signed')).resolves.toBe('signed');
  });

  it('expires at the five-minute boundary without invoking the wallet', async () => {
    vi.useFakeTimers();
    const sign = vi.fn();
    await expect(executeSigningReview(signingRequest(), async () => {
      vi.setSystemTime(Date.now() + 300_000); return true;
    }, () => true, sign)).rejects.toThrow('expired');
    expect(sign).not.toHaveBeenCalled();
  });

  it('fails closed on invalid payload, failed presenter or failed context lookup and permits retry', async () => {
    const sign = vi.fn();
    await expect(executeSigningReview(signingRequest('bad'), async () => true, () => true, sign)).rejects.toThrow();
    await expect(executeSigningReview(signingRequest(), async () => { throw new Error('UI unavailable'); }, () => true, sign)).rejects.toThrow('UI unavailable');
    await expect(executeSigningReview(signingRequest(), async () => true, async () => { throw new Error('disconnected'); }, sign)).rejects.toThrow('disconnected');
    expect(sign).not.toHaveBeenCalled();
    await expect(executeSigningReview(signingRequest(), async () => true, () => true, async () => 'retry')).resolves.toBe('retry');
  });
});
