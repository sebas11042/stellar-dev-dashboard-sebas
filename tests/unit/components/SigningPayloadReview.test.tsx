import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { afterEach, describe, expect, it, vi } from 'vitest';
import SigningPayloadReview from '../../../src/components/security/SigningPayloadReview';
import { presentSigningReview } from '../../../src/components/security/presentSigningReview';
import type { SigningSummary } from '../../../src/lib/wallet/signingPayloadTypes';

const summary: SigningSummary = {
  title: 'Review message signature', fingerprint: 'a'.repeat(64),
  fields: { signer: 'Full signer account', message: '<script>unsafe()</script>', amount: '900719925.1234567' },
  warnings: ['A message can grant permissions.'],
};
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe('SigningPayloadReview', () => {
  it('requires acknowledgement, displays literal content and returns approval once', async () => {
    const user = userEvent.setup(); const decide = vi.fn();
    render(<SigningPayloadReview summary={summary} onDecision={decide} />);
    expect(screen.getByRole('dialog', { name: summary.title })).toBeInTheDocument();
    expect(screen.getByText('<script>unsafe()</script>')).toBeInTheDocument();
    expect(document.querySelector('script')).toBeNull();
    const approve = screen.getByRole('button', { name: 'Approve and open wallet' });
    expect(approve).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancel signing' })).toHaveFocus();
    await user.click(screen.getByRole('checkbox'));
    await user.dblClick(approve);
    expect(decide).toHaveBeenCalledExactlyOnceWith(true);
  });

  it('supports Escape and traps keyboard focus within the dialog', async () => {
    const user = userEvent.setup(); const decide = vi.fn();
    render(<SigningPayloadReview summary={summary} onDecision={decide} />);
    await user.click(screen.getByRole('checkbox'));
    screen.getByRole('button', { name: 'Approve and open wallet' }).focus();
    await user.tab();
    expect(screen.getByLabelText('Signing payload details')).toHaveFocus();
    await user.keyboard('{Escape}');
    expect(decide).toHaveBeenCalledWith(false);
  });

  it('has no axe accessibility violations', async () => {
    const { container } = render(<SigningPayloadReview summary={summary} onDecision={vi.fn()} />);
    expect((await axe(container)).violations).toEqual([]);
  });

  it('cleans the mounted review, restores inert state and returns focus on cancel', async () => {
    const origin = document.createElement('button'); origin.textContent = 'Start';
    document.body.append(origin); origin.focus();
    let pending!: Promise<boolean>;
    act(() => { pending = presentSigningReview(summary); });
    expect(origin.inert).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel signing' }));
    await expect(pending).resolves.toBe(false);
    expect(document.querySelector('[data-signing-review]')).toBeNull();
    expect(origin.inert).toBeFalsy();
    expect(origin).toHaveFocus(); origin.remove();
  });

  it('cancels when navigating away and allows another review', async () => {
    let pending!: Promise<boolean>;
    act(() => { pending = presentSigningReview(summary); });
    act(() => { window.dispatchEvent(new Event('pagehide')); });
    await expect(pending).resolves.toBe(false);
    act(() => { pending = presentSigningReview(summary); });
    fireEvent.click(screen.getByRole('button', { name: 'Cancel signing' }));
    await expect(pending).resolves.toBe(false);
  });

  it('automatically closes an abandoned review at expiry', async () => {
    vi.useFakeTimers(); let pending!: Promise<boolean>;
    act(() => { pending = presentSigningReview(summary); });
    act(() => { vi.advanceTimersByTime(300_000); });
    await expect(pending).resolves.toBe(false);
    expect(document.querySelector('[data-signing-review]')).toBeNull();
  });
});
