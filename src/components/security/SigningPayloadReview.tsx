import { useEffect, useId, useRef, useState } from 'react';
import { readableLabel } from '../../lib/wallet/readableSigningValue';
import type { ReadableValue, SigningSummary } from '../../lib/wallet/signingPayloadTypes';

function Value({ value }: { value: ReadableValue }) {
  if (value === null) return <span>None</span>;
  if (Array.isArray(value)) {
    return value.length ? (
      <ol>
        {value.map((entry, index) => (
          <li key={index}>
            <Value value={entry} />
          </li>
        ))}
      </ol>
    ) : (
      <span>None</span>
    );
  }
  if (typeof value === 'object') {
    return (
      <dl>
        {Object.entries(value).map(([key, entry]) => (
          <div key={key}>
            <dt>{readableLabel(key)}</dt>
            <dd>
              <Value value={entry} />
            </dd>
          </div>
        ))}
      </dl>
    );
  }
  return <span className="signing-review-value">{String(value)}</span>;
}

export default function SigningPayloadReview({
  summary,
  onDecision,
}: {
  summary: SigningSummary;
  onDecision: (_approved: boolean) => void;
}) {
  const titleId = useId();
  const descriptionId = useId();
  const container = useRef<HTMLDivElement>(null);
  const cancel = useRef<HTMLButtonElement>(null);
  const [acknowledged, setAcknowledged] = useState(false);
  const decided = useRef(false);
  const decide = (approved: boolean) => {
    if (decided.current) return;
    decided.current = true;
    onDecision(approved);
  };

  useEffect(() => {
    cancel.current?.focus();
  }, []);

  return (
    <div className="signing-review-backdrop">
      <div
        className="signing-review"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        ref={container}
        tabIndex={-1}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.preventDefault();
            decide(false);
          }
          if (event.key !== 'Tab') return;
          const controls = Array.from(
            container.current?.querySelectorAll<HTMLElement>(
              'button, input, summary, [tabindex="0"]'
            ) ?? []
          ).filter((element) => !element.hasAttribute('disabled'));
          if (!controls?.length) return;
          const first = controls[0];
          const last = controls[controls.length - 1];
          if (
            event.shiftKey &&
            (document.activeElement === first || document.activeElement === container.current)
          ) {
            event.preventDefault();
            last.focus();
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first.focus();
          }
        }}
      >
        <h2 id={titleId}>{summary.title}</h2>
        <p id={descriptionId}>
          Read the complete request before allowing your wallet to sign. Cancel if anything is
          unexpected.
        </p>
        <div className="signing-review-content" tabIndex={0} aria-label="Signing payload details">
          <Value value={summary.fields} />
          <ul>
            {summary.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
          <details>
            <summary>Request fingerprint</summary>
            <p className="signing-review-value">{summary.fingerprint}</p>
            <p>This identifies the reviewed request; it does not prove the request is safe.</p>
          </details>
        </div>
        <label className="signing-review-acknowledgement">
          <input
            type="checkbox"
            checked={acknowledged}
            onChange={(event) => setAcknowledged(event.target.checked)}
          />
          I reviewed this exact payload and signer.
        </label>
        <div className="signing-review-actions">
          <button type="button" ref={cancel} onClick={() => decide(false)}>
            Cancel signing
          </button>
          <button type="button" disabled={!acknowledged} onClick={() => decide(true)}>
            Approve and open wallet
          </button>
        </div>
      </div>
    </div>
  );
}
