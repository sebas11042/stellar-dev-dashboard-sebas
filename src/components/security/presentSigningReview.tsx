import { createRoot } from 'react-dom/client';
import SigningPayloadReview from './SigningPayloadReview';
import type { SigningSummary } from '../../lib/wallet/signingPayloadTypes';
import './signingPayloadReview.css';

/** Mounted on demand so every adapter caller receives the same mandatory UI. */
export function presentSigningReview(summary: SigningSummary): Promise<boolean> {
  if (typeof document === 'undefined' || !document.body) {
    return Promise.reject(new Error('Signing review requires an interactive browser.'));
  }
  return new Promise((resolve, reject) => {
    const previousFocus = document.activeElement;
    const background = [...document.body.children].filter((node): node is HTMLElement => node instanceof HTMLElement)
      .map((node) => ({ node, inert: node.inert }));
    const host = document.createElement('div');
    host.dataset.signingReview = 'true';
    document.body.append(host);
    const root = createRoot(host);
    let finished = false;
    const cleanup = () => {
      window.removeEventListener('pagehide', cancel);
      window.clearTimeout(timeout);
      root.unmount(); host.remove();
      for (const { node, inert } of background) node.inert = inert;
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus();
    };
    const finish = (approved: boolean) => {
      if (finished) return;
      finished = true;
      cleanup(); resolve(approved);
    };
    const cancel = () => finish(false);
    const timeout = window.setTimeout(cancel, 5 * 60 * 1000);
    window.addEventListener('pagehide', cancel, { once: true });
    try {
      for (const { node } of background) node.inert = true;
      root.render(<SigningPayloadReview summary={summary} onDecision={finish} />);
    } catch (error) {
      finished = true; cleanup(); reject(error);
    }
  });
}
