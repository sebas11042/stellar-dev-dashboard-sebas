# Issue #1192 verification and PR notes

## Scope

Mandatory readable verification for wallet transaction envelopes (including
fee-bump), Soroban authorization entries, and DID authentication messages.
The decoder is offline; approval binds the exact payload and context, is
single-use, expires after five minutes, and is invalidated by context changes.
Anchor authentication and SAC deployment now use the reviewed adapter boundary.

The change does not repair unrelated dashboard, core-package, CI-policy or
dependency problems. No required check is disabled and no exception is assumed.
There are no new dependencies, endpoint changes, key-handling changes, signing
algorithm changes, or changes to session lifetime.

See [readable signing payloads](../features/readable-signing-payloads.md) for
user steps, API integration, recovery, accessibility and security considerations.

## Reproduce

Use the project's supported Node/pnpm versions and installed workspace dependencies.
The normal clean-install command remains `pnpm install --frozen-lockfile`; its
existing upstream failure is recorded below, not worked around in CI.

```bash
pnpm run test:wallet-signing
pnpm exec playwright install chromium firefox webkit
pnpm run test:e2e:signing
pnpm run test:e2e:signing:production
pnpm exec tsc --noEmit --skipLibCheck --target ES2022 --module ESNext --moduleResolution bundler --esModuleInterop --jsx react-jsx --types node --typeRoots packages/core/node_modules/@types src/lib/wallet/signingPayload.ts src/lib/wallet/signingReviewGate.ts src/components/security/SigningPayloadReview.tsx src/components/security/presentSigningReview.tsx
pnpm exec eslint src/lib/wallet/signingPayloadTypes.ts src/lib/wallet/readableSigningValue.ts src/lib/wallet/transactionSigningDetails.ts src/lib/wallet/authorizationSigningDetails.ts src/lib/wallet/signingPayload.ts src/lib/wallet/signingReviewGate.ts src/components/security/SigningPayloadReview.tsx src/components/security/presentSigningReview.tsx tests/unit/wallet tests/unit/components/SigningPayloadReview.test.tsx tests/__factories__/signingPayloads.ts tests/e2e/signing-payload-review.spec.ts tests/e2e/fixtures/signing-payload-review.tsx tests/e2e/signing-review.config.ts tests/e2e/signing-review.production.config.ts tests/e2e/signing-review.vite.config.ts --max-warnings 0
pnpm run governance:check
pnpm run check:strict-tsconfig
pnpm run check:node
git diff --check
```

Formatting of new files can be reproduced in PowerShell:

```powershell
$signingNewFiles = @(git diff --name-only --diff-filter=A upstream/master -- '*.ts' '*.tsx' '*.css' '*.html' '*.md')
pnpm exec prettier --check $signingNewFiles package.json docs/WALLET_ADAPTERS.md
```

The dedicated Playwright configuration is a component-browser harness using
real SDK decoding, the actual approval gate and the actual presenter. Its
provider callback is synthetic. It tests the new behavior without importing the
entire dashboard. It does **not** replace application-level wallet E2E, the
standard Playwright configuration, or any required repository checks. Adapter
integration tests separately exercise real adapter/gate/decoder code against
mocked wallet providers; DID tests complete authentication using a real test
signature. The boundary test prohibits raw wallet transport calls from
application modules outside the wallet implementation directory.

The production command builds only this synthetic harness into the ignored
`reports/1192/browser-build` directory, then repeats the browser suite against
Vite preview. It verifies minified SDK string handling and actual readable
field contents, not just the presence of a dialog. It does not establish that
the full application builds or meets its bundle budgets.

The minified-harness run also passed all 32 cases on the four browsers.

## Local evidence (2026-10-18)

Environment: Windows, Node 22.12.0, pnpm 9.15.3. Branch:
`feat/1192-readable-signing-payloads`, created directly from upstream/master
`78239f245b892392bedb6628eea698dc344b7df9` after fetching both remotes.
The earlier #1187 feature commits are not included in this branch.

| Check                                                | Result                                                                                  |
| ---------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Focused unit/integration suite                       | 54 passed across 11 files, including 50 new tests and 4 updated adapter tests           |
| Focused browser suite                                | 32 passed: 8 scenarios on Chromium, Firefox, WebKit and mobile Chrome                   |
| Browser accessibility                                | axe WCAG 2 A/AA and 2.1 AA checks passed for all four request kinds on each browser     |
| Component accessibility                              | axe passed; keyboard trapping, Escape, expiry, navigation and focus restoration covered |
| Isolated decoder/gate/presenter type check           | Passed; this is not a passing repository-wide type check                                |
| New executable code lint                             | Passed with zero warnings                                                               |
| Modified existing source lint diagnostics            | No additions compared with upstream/master                                              |
| Formatting of new files and changed package manifest | Passed                                                                                  |
| Governance                                           | Passed; 91 sensitive files owned, 12 labels defined                                     |
| Strict tsconfig ratchet and Node policy              | Passed                                                                                  |

Coverage includes exact amounts and integers above JavaScript's safe-integer
range, asset issuers, non-payment operations, Soroban contract arguments, outer
and inner fee-bump details, complete nested authorization trees, nonce and uint32
ledger-expiry boundaries, duplicate SCMap entries, message origins, visible
control characters, literal markup, UTF-8 byte limits, invalid Unicode,
noncanonical/trailing XDR, unsupported kinds, oversized input, cancellation,
concurrent requests, expiry during asynchronous checks, changed provider or
dashboard context, missing signer, failed presentation, provider rejection,
and recovery with fresh approval. Browser fixtures block external requests.

## Outstanding merge requirements

**This branch is not merge-ready.** Remote GitHub CI has not been run for this
local branch. All required checks on the eventual PR head must pass, or a
maintainer must approve a narrowly scoped exception. Focused passing results
are not evidence that the whole repository passes.

- `pnpm install --frozen-lockfile --ignore-scripts --offline` fails with
  `ERR_PNPM_OUTDATED_LOCKFILE`: the existing lockfile lacks the core workspace
  dependency specifiers. The manifest/lockfile dependency declarations are
  unchanged by this issue. Locally available dependencies were used to verify
  the feature; no successful clean install is claimed. `--ignore-scripts` was
  used only for this diagnostic, not added to any CI command.
- `pnpm run type-check` fails on the existing unclosed JSX in
  `src/components/dashboard/AuditLog.tsx` at lines 406 and 770/771.
- `pnpm run build` fails on the same existing JSX. Bundle/performance budgets
  cannot be established until the application builds successfully.
- `pnpm run lint` fails on existing repository errors and warnings, including
  the AuditLog syntax error and direct submission in AssetIssuanceWizard.
  Diagnostics in each modified existing source file were compared with the
  upstream version; no additional diagnostics were introduced by this change.
- Global `pnpm run format:check` still rejects unchanged `eslint.config.js`,
  `tsconfig.json`, `.github/workflows/ci.yml` and `.prettierrc.json`.
- `pnpm run docs:validate-drift` reports existing broken references in the ADRs
  and protocol upgrade tracker. New guide/report links are valid.
- `pnpm audit --prod --json` reports 1 low, 19 moderate, 30 high and 3 critical
  findings in the locally installed production graph. No dependency upgrade,
  audit suppression or SLA exception is included in this wallet issue.
- The standard application dev-server dependency scan also reports unresolved
  core package entry points. The focused browser harness does not demonstrate
  a working full application, and full application E2E/accessibility remain
  required. Full-repository tests, coverage and remote security workflows are
  not established by the focused runs.

These unrelated source/configuration blockers remain unchanged from the starting
upstream commit. Local diagnostic logs are ignored under `reports/1192/`;
Playwright traces on failure are under `test-results/`.

## Security review for the PR

The changed wallet/security/authentication paths are covered by existing
CODEOWNERS rules and require code-owner review. No approval is claimed here.
Decoding and rendering introduce no network lookup, payload storage, telemetry,
or logging. No secret keys are passed to adapters. Fixed test seeds are synthetic
and must never fund real accounts. Origin labels and SHA-256 fingerprints are
context/integrity information, not trust endorsements. Review makes permissions
visible but does not prove that a recipient or contract is safe.
