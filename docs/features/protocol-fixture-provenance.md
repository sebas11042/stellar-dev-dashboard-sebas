# Protocol fixture provenance and refresh (#1187)

The committed corpus at `tests/__factories__/protocol-fixtures.generated.json`
is generated from the existing Soroban factory. It covers simulation success,
CPU and memory limits (equal to and one unit above each limit), authorization
failure, budget exhaustion, restoration, JSON-RPC failure, and protocol discovery.
Tests decode its XDR with the installed Stellar SDK and exercise the application's
simulation outcome classifier.

## Provenance contract

`tests/__factories__/protocol-fixture-spec.json` declares the schema, synthetic
origin, modeled protocol, test network, deterministic seed, starting ledger, and
protocol reference. Protocol 22 is the existing factory's compatibility target;
it is not a claim about the current live network. The reference is contextual
documentation, not a fetched data source or a complete protocol certification.

Every corpus records the installed SDK version, generator path, SHA-256 hashes
of the spec, factory, classifier, generator sources and pnpm lockfile, plus a
SHA-256 hash of each serialized JSON-RPC response. Source CRLF is normalized to
LF before hashing so Linux and Windows checkouts agree. Formatting and property
order in the generated JSON are part of the contract. Timestamps, local paths,
environment variables and random values never enter the corpus.

These hashes detect accidental changes and stale fixtures; they are not signed
attestations. Reviewers must inspect source, dependency and corpus diffs together.
The registry is deliberately scoped to Soroban protocol fixtures, not unrelated
demo or sandbox datasets.

## Refresh and verify

Use a supported Node version and the repository's pinned pnpm version:

```bash
pnpm install --frozen-lockfile
pnpm run fixtures:protocol:refresh
pnpm run fixtures:protocol:check
pnpm run test:protocol-fixtures
pnpm exec vitest run tests/unit/protocolFixtureCorpus.test.ts tests/unit/sorobanContractFixtures.test.ts
```

Run refresh after changing any recorded input, including an SDK/lockfile update.
Inspect and commit the generated JSON with the changes that required it. Repeating
refresh with unchanged inputs leaves the file untouched. The CLI resolves paths
relative to its module, so invoking it from another working directory also works.

To model another protocol, review its actual RPC/XDR and resource semantics,
update the factory's `FIXTURE_PROTOCOL_VERSION` and the spec together, add any new
cases, then regenerate and run both suites. Changing only the number is not a
protocol migration. A testnet reset does not require refresh: no live ledger data
is captured. To change the synthetic ledger baseline, edit `startLedger` in the spec.

## Failure and recovery

- `--check` returns exit code 1 for a missing, corrupt or stale corpus and never
  writes it. Run refresh, inspect the diff, then check again.
- Invalid JSON, unsupported schema/network, invalid numeric bounds, or a protocol
  mismatch abort before writing. Correct the spec/factory; the previous corpus
  remains available.
- Refresh stages a complete file alongside its destination and renames it into
  place. A failed write or rename fails the command and cleans up the temporary
  file; it does not truncate the committed corpus. Correct filesystem permissions
  and retry. A forcibly killed process can leave a `.tmp` file, which can be removed.
- Unknown or repeated CLI flags fail. There is no custom endpoint, output path,
  mainnet, signing or submission mode.

## Automation and merge requirements

The **Protocol fixture provenance** workflow runs integrity checks, lifecycle and
CLI tests, SDK/classifier integration tests, corpus integration type checking,
and tooling formatting on pull requests
and default-branch pushes across Node 22, 24 and 26. Add its three integrity jobs
to branch protection as required checks; repository settings cannot be enforced
by a workflow file alone.

Every Monday at 08:30 UTC, and on manual dispatch, a separate job regenerates and
validates the corpus and uploads `protocol-fixture-refresh` for 14 days. Download
and review that artifact before committing any refresh. The workflow has only
`contents: read`, disables persisted checkout credentials, and never pushes,
opens PRs, approves changes or bypasses a failing integrity job. Scheduled runs
use installed locked dependencies; they do not discover new upstream protocols
or SDK versions. Dependency updates continue through the existing update process.

All existing required checks still apply: lint, format, type checks, coverage,
Playwright/accessibility, build/performance budgets, dependency/security checks,
documentation drift, and governance. A passing fixture job does not replace them.

## Security, privacy, accessibility and network safety

Generation and checks make no network requests. Only fixed repository-owned code
is transpiled in memory with the existing TypeScript dependency; no user-selected
code or remote source is loaded. Do not run an untrusted checkout with secrets.
The seed derives public synthetic account/contract identifiers, never private
keys. No captured user payloads, credentials, wallet operations or production
addresses are included. Package installation still requires the ordinary package
registry access. CI uses ordinary unprivileged pull-request events, not
`pull_request_target`, and scheduled artifacts require human review.

All changes are test/contributor tooling. There are no UI, accessibility or
production bundle changes; existing browser and accessibility CI remains required.
