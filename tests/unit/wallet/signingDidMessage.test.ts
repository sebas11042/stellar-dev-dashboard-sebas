// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
vi.unmock('@stellar/stellar-sdk');
const mocks = vi.hoisted(() => ({ present: vi.fn() }));
vi.mock('../../../src/components/security/presentSigningReview', () => ({ presentSigningReview: mocks.present }));
import { authenticateWithFreighter, clearAuthSession, getAuthSession } from '../../../src/lib/didAuth';
import { signingAccount, signingRecipient } from '../../__factories__/signingPayloads';

const provider = { getPublicKey: vi.fn(), signMessage: vi.fn() };
beforeEach(() => {
  vi.clearAllMocks();
  const storage = new Map<string, string>();
  vi.stubGlobal('sessionStorage', { getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value), removeItem: (key: string) => storage.delete(key) });
  vi.stubGlobal('window', { freighterApi: provider, location: { hostname: 'dashboard.example', origin: 'https://dashboard.example' } });
  provider.getPublicKey.mockResolvedValue(signingAccount.publicKey());
  provider.signMessage.mockImplementation(async (message: string) => Buffer.from(signingAccount.sign(Buffer.from(message))).toString('base64'));
  mocks.present.mockResolvedValue(true);
});
afterEach(() => { vi.unstubAllGlobals(); });

describe('DID message signing review integration', () => {
  it('reviews the exact challenge and successfully authenticates after approval', async () => {
    mocks.present.mockImplementationOnce(async (summary) => {
      expect(summary.title).toBe('Review message signature');
      expect(summary.fields['message (exact text; controls escaped)']).toContain('dashboard.example');
      expect(provider.signMessage).not.toHaveBeenCalled(); return true;
    });
    const result = await authenticateWithFreighter();
    expect(result.success).toBe(true);
    expect(provider.signMessage).toHaveBeenCalledWith(JSON.stringify(getAuthSession()!.challenge));
  });

  it('does not sign a cancelled message and allows a new login attempt', async () => {
    mocks.present.mockResolvedValueOnce(false);
    expect((await authenticateWithFreighter()).error).toContain('cancelled');
    expect(provider.signMessage).not.toHaveBeenCalled();
    expect((await authenticateWithFreighter()).success).toBe(true);
  });

  it.each(['account', 'session'])('rejects approval after the %s changes', async (change) => {
    mocks.present.mockImplementationOnce(async () => {
      if (change === 'account') provider.getPublicKey.mockResolvedValue(signingRecipient.publicKey());
      else clearAuthSession();
      return true;
    });
    expect((await authenticateWithFreighter()).error).toContain('changed');
    expect(provider.signMessage).not.toHaveBeenCalled();
  });

  it('reports a wallet rejection without authenticating', async () => {
    provider.signMessage.mockRejectedValueOnce(new Error('User rejected message'));
    expect(await authenticateWithFreighter()).toMatchObject({ success: false, error: 'User rejected message' });
    expect(getAuthSession()!.did).toBeNull();
  });
});
