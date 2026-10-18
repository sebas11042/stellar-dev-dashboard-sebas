// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
vi.unmock('@stellar/stellar-sdk');
const mocks = vi.hoisted(() => ({
  present: vi.fn(),
  state: {
    walletConnected: true,
    walletType: 'freighter',
    walletPublicKey: '',
    network: 'testnet',
  },
}));
vi.mock('../../../src/components/security/presentSigningReview', () => ({
  presentSigningReview: mocks.present,
}));
vi.mock('../../../src/lib/store', () => ({ useStore: { getState: () => mocks.state } }));
vi.mock('../../../src/lib/stellar', async () => {
  const { Networks } = await import('@stellar/stellar-sdk');
  return {
    NETWORKS: {
      testnet: { passphrase: Networks.TESTNET },
      mainnet: { passphrase: Networks.PUBLIC },
    },
  };
});
import { getWalletAdapter } from '../../../src/lib/wallet/adapters';
import { __resetFreighterApiCacheForTests } from '../../../src/lib/wallet/freighter';
import {
  signingAccount,
  signingAuthorization,
  signingRecipient,
  signingRequest,
} from '../../__factories__/signingPayloads';

const provider = {
  getAddress: vi.fn(),
  getNetwork: vi.fn(),
  signTransaction: vi.fn(),
  signAuthEntry: vi.fn(),
};
beforeEach(() => {
  vi.clearAllMocks();
  __resetFreighterApiCacheForTests();
  vi.stubGlobal('window', { freighterApi: provider });
  provider.getAddress.mockResolvedValue({ address: signingAccount.publicKey() });
  provider.getNetwork.mockResolvedValue({ network: 'TESTNET' });
  provider.signTransaction.mockResolvedValue({ signedTxXdr: 'signed transaction' });
  provider.signAuthEntry.mockResolvedValue({ signedAuthEntryXdr: 'signed authorization' });
  mocks.present.mockResolvedValue(true);
  mocks.state.network = 'testnet';
});
afterEach(() => {
  vi.unstubAllGlobals();
  __resetFreighterApiCacheForTests();
});

describe('mandatory adapter signing review', () => {
  it('does not invoke the transaction provider until the review is approved', async () => {
    mocks.present.mockImplementationOnce(async (summary) => {
      expect(summary.title).toBe('Review transaction');
      expect(provider.signTransaction).not.toHaveBeenCalled();
      return true;
    });
    const payload = signingRequest().payload;
    await expect(getWalletAdapter('freighter').signTransaction(payload, 'testnet')).resolves.toBe(
      'signed transaction'
    );
    expect(provider.signTransaction).toHaveBeenCalledWith(payload, { network: 'TESTNET' });
  });

  it('reviews authorization entries before calling the auth provider', async () => {
    const payload = signingAuthorization();
    await expect(getWalletAdapter('freighter').signAuthEntry(payload, 'testnet')).resolves.toBe(
      'signed authorization'
    );
    expect(mocks.present.mock.calls[0][0].title).toBe('Review Soroban authorization');
    expect(provider.signAuthEntry).toHaveBeenCalledWith(payload, { network: 'TESTNET' });
  });

  it('cancels both signature types without contacting either signing method', async () => {
    mocks.present.mockResolvedValue(false);
    await expect(
      getWalletAdapter('freighter').signTransaction(signingRequest().payload, 'testnet')
    ).rejects.toThrow('cancelled');
    await expect(
      getWalletAdapter('freighter').signAuthEntry(signingAuthorization(), 'testnet')
    ).rejects.toThrow('cancelled');
    expect(provider.signTransaction).not.toHaveBeenCalled();
    expect(provider.signAuthEntry).not.toHaveBeenCalled();
  });

  it.each(['account', 'provider network', 'dashboard network'])(
    'invalidates approval when %s changes',
    async (change) => {
      mocks.present.mockImplementationOnce(async () => {
        if (change === 'account')
          provider.getAddress.mockResolvedValue({ address: signingRecipient.publicKey() });
        if (change === 'provider network')
          provider.getNetwork.mockResolvedValue({ network: 'PUBLIC' });
        if (change === 'dashboard network') mocks.state.network = 'mainnet';
        return true;
      });
      await expect(
        getWalletAdapter('freighter').signTransaction(signingRequest().payload, 'testnet')
      ).rejects.toThrow('changed');
      expect(provider.signTransaction).not.toHaveBeenCalled();
    }
  );

  it('fails closed on invalid auth XDR or unsupported auth capability', async () => {
    await expect(
      getWalletAdapter('freighter').signAuthEntry('invalid', 'testnet')
    ).rejects.toThrow();
    await expect(
      getWalletAdapter('ledger').signAuthEntry(signingAuthorization(), 'testnet')
    ).rejects.toThrow('does not support');
    expect(mocks.present).not.toHaveBeenCalled();
    expect(provider.signAuthEntry).not.toHaveBeenCalled();
  });

  it('releases the review after provider rejection and permits a fresh retry', async () => {
    provider.signTransaction.mockRejectedValueOnce(new Error('User declined signing'));
    await expect(
      getWalletAdapter('freighter').signTransaction(signingRequest().payload, 'testnet')
    ).rejects.toThrow('declined');
    await expect(
      getWalletAdapter('freighter').signTransaction(signingRequest().payload, 'testnet')
    ).resolves.toBe('signed transaction');
    expect(mocks.present).toHaveBeenCalledTimes(2);
  });

  it('checks the dashboard again after the asynchronous provider network lookup', async () => {
    let reads = 0;
    provider.getNetwork.mockImplementation(async () => {
      if (++reads === 3) mocks.state.network = 'mainnet';
      return { network: 'TESTNET' };
    });
    await expect(
      getWalletAdapter('freighter').signTransaction(signingRequest().payload, 'testnet')
    ).rejects.toThrow('changed');
    expect(provider.signTransaction).not.toHaveBeenCalled();
  });
});
