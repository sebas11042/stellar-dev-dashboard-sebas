# Readable wallet signing payloads

Every transaction or Soroban authorization requested through `WalletAdapter`
requires a readable review before opening the wallet. DID login messages use
the same review boundary. Anchor authentication and SAC deployment also route
through the reviewed adapters. Existing mainnet guards and wallet/device
confirmation still apply. Disabling optional transaction confirmation in
preferences does not disable this review.

## Review a request

1. Start signing or wallet authentication as usual.
2. Check the full signer account and explicit network passphrase. For messages,
   check the requesting origin and the complete message instead.
3. Read every operation or authorized invocation, including nested calls.
   Fee-bump requests distinguish the fee payer/maximum fee from the inner
   transaction. Transaction details include the complete envelope, including
   preconditions and Soroban extensions, rather than a payment-only preview.
4. Select **I reviewed this exact payload and signer**, then **Approve and open
   wallet**. Approval permits one provider invocation with the captured payload.
5. Verify the wallet/device display before giving its separate confirmation.

Amounts and integers remain strings without floating-point conversion. Asset
issuers and accounts are not shortened. Rational prices retain their exact
numerator/denominator in the complete envelope even when the SDK's operation
preview provides a decimal. Binary values are labeled as hexadecimal. Soroban
maps retain every key/value pair, including duplicate keys. Control and bidi
characters in text are displayed as visible `\uXXXX` escapes, not executed or
interpreted as markup.

## Cancellation and recovery

- **Cancel signing** or Escape closes the review without calling the signing
  provider. Focus returns to the initiating control when it still exists.
- A review expires after five minutes or closes when navigating away. Start a
  fresh review; an old acknowledgement cannot be reused.
- Changing the wallet account, selected wallet, dashboard network, or network
  passphrase invalidates adapter approval. Provider account/network are checked
  again after approval. DID login also verifies the provider, origin, challenge,
  and active session. Restart after switching accounts or networks.
- A concurrent signing request is refused while another signing operation is
  active. Finish or cancel it first.
- Invalid/noncanonical XDR, missing context, unreviewable data, and unsupported
  capabilities fail before signing. Rebuild the payload or use a supported
  wallet. If the provider cannot report its account or required network,
  reconnect or use a provider that implements those queries.
- A wallet rejection or provider error is returned to the caller. Retry creates
  a new review and does not reuse approval.

Review limits are 256 KiB of UTF-8 input for base64 XDR, 16 KiB of UTF-8 input
for messages, 32 nested value levels, and 20,000 visited nodes per value traversal.
Details exceeding a limit are rejected rather than silently shortened. Split
an oversized request upstream; there is no blind-signing fallback.

## Contributor contract

Application callers must use `getWalletAdapter(...).signTransaction` or
`.signAuthEntry`. Connector helpers are low-level transports used by the
reviewed registry, not alternative application entry points. The boundary test
rejects raw transport references outside the wallet implementation directory.
Do not add a UI-specific bypass or a preference to suppress mandatory review.

`summarizeSigningPayload` is a pure offline decoder. `executeSigningReview`
captures an immutable request, requires approval, verifies current context and
expiry, and invokes the signing callback once. Add new wallet payload kinds to
the discriminated request type, decoder, review integration and tests together.
An unknown kind is refused. Local server/issuer keypair signing, webhook HMAC,
and unsupported placeholder features are outside this wallet-provider change.

The on-demand presenter isolates the background with `inert`, traps keyboard
focus, labels the dialog and checkbox, supports Escape, restores focus, and
cleans up after cancellation, expiry and navigation. Maintain these behaviors
when extending the view. The scrollable details area is keyboard-focusable.

## Security, privacy and network safety

The decoder makes no Horizon/RPC requests, simulations, ABI downloads or origin
lookups. Only existing wallet provider queries/signature methods are used by
the integration. This change adds no endpoint, secret-key handling, storage,
analytics or payload logging. Browser tests use synthetic accounts and block
external network access. Never use their fixed seeds for funded accounts.

An XDR envelope does not establish its intended network by itself: review binds
the selected passphrase and checks provider/dashboard context. Message signatures
are network independent. A displayed origin identifies request context, not
verified authorship of text embedded in the message. Ledger expiry is displayed
as a ledger number; offline review does not claim it is currently valid.

The SHA-256 request fingerprint includes kind, exact input, signer, passphrase
and origin. It detects request differences; it is not a signature, simulation,
contract audit, scam check or trust endorsement. Readable data does not establish
that a contract is safe. Review every nested permission and confirm on the wallet.

Wallet, authentication and security component changes require the existing
CODEOWNERS review. Existing required CI checks remain mandatory; the focused
browser harness does not replace application E2E, bundle or performance gates.

See the [verification report](../verification/issue-1192.md) for commands,
evidence and outstanding repository checks.
