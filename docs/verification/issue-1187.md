# Issue #1187 verification and PR notes

## Change

Add synthetic Soroban protocol fixture provenance and reproducible refresh
automation. The corpus is built from the existing factory, records its modeled
protocol and installed SDK, and hashes source inputs and each response. Checks
detect missing, corrupt or stale output without modifying it. Refresh validates
inputs before an atomic replacement and cleans up failed staging files.

Closes #1187 after review and all required checks pass.

The new workflow checks Node 22/24/26 on PRs and default-branch pushes. Weekly
and manual runs prepare validated artifacts for human review with read-only
repository permissions. No workflow publishes changes or bypasses integrity
checks. Maintainers must configure the three integrity jobs as required checks.

## Reproduce

```bash
pnpm install --frozen-lockfile
pnpm run fixtures:protocol:refresh
pnpm run fixtures:protocol:check
pnpm run test:protocol-fixtures
pnpm exec vitest run tests/unit/protocolFixtureCorpus.test.ts tests/unit/sorobanContractFixtures.test.ts
pnpm exec tsc --noEmit --skipLibCheck --target ES2022 --module ESNext --moduleResolution bundler --resolveJsonModule --esModuleInterop --types node --typeRoots packages/core/node_modules/@types tests/unit/protocolFixtureCorpus.test.ts
pnpm exec eslint scripts/protocol-fixtures.mjs scripts/refresh-protocol-fixtures.mjs tests/ci/protocol-fixture-*.test.mjs tests/unit/protocolFixtureCorpus.test.ts tests/__factories__/sorobanContractFixtures.ts --max-warnings 0
pnpm exec prettier --check scripts/protocol-fixtures.mjs scripts/refresh-protocol-fixtures.mjs tests/ci/protocol-fixture-*.test.mjs tests/unit/protocolFixtureCorpus.test.ts tests/__factories__/protocol-fixture-spec.json tests/__factories__/protocol-fixtures.generated.json .github/workflows/protocol-fixtures.yml docs/features/protocol-fixture-provenance.md docs/verification/issue-1187.md
pnpm run governance:check
git diff --check
```

See the [maintenance guide](../features/protocol-fixture-provenance.md) for
protocol migration and failure recovery.

## Local evidence (2026-10-18)

Environment: Windows, Node 22.12.0, pnpm 9.15.3. CI pins pnpm 9.15.0.
GitHub's public repository API confirmed that
`sebas11042/stellar-dev-dashboard-sebas` is a fork of
`Nanle-code/stellar-dev-dashboard`. Both remote master branches and the starting
checkout pointed to `78239f245b892392bedb6628eea698dc344b7df9`.
Work is isolated on `feat/1187-protocol-fixture-provenance`.

| Verification                                                  | Result                                    |
| ------------------------------------------------------------- | ----------------------------------------- |
| Fixture check and repeat refresh                              | Pass; unchanged inputs produce no rewrite |
| Provenance/lifecycle/CLI/offline tests                        | 13 passed                                 |
| Corpus and existing Soroban factory tests                     | 38 passed                                 |
| Isolated corpus integration type check                        | Pass; existing core workspace Node types  |
| Lint of all changed executable files                          | Pass with zero warnings                   |
| Formatting of new tooling, workflow, corpus and feature guide | Pass                                      |
| Governance                                                    | Pass; 83 sensitive files owned, 12 labels |
| Strict tsconfig ratchet                                       | Pass                                      |
| Node policy and its boundary tests                            | Pass; 4 tests                             |
| Vulnerability SLA policy unit tests                           | Pass; 13 tests                            |
| Frozen installation with local native scripts disabled        | Pass; lockfile resolution skipped         |

Tests cover equal/over-limit CPU and memory, valid SDK XDR, auth/RPC/resource
failures, restoration, deterministic hashes, CRLF normalization, invalid schemas,
network substitutions, unexpected metadata, corrupt/missing output, read-only
checks, successful recovery, atomic replacement failure and staging cleanup.
Network entry points are blocked during an independent generation test.

## Outstanding repository checks

This branch is **not merge-ready**. No maintainer exception was requested or
assumed. No checks were disabled. Remote GitHub CI has not been run for this local
branch, and Linux/Node 24/26 results remain to be established by CI.

- The initial frozen install failed because existing root/mobile workspace
  dependencies and the entire `packages/core` importer were missing from the
  lockfile. The dedicated lockfile commit synchronizes existing manifests; no
  new dependency was declared for fixture tooling.
- Ordinary Windows installation then failed in the existing TensorFlow native
  install: its Windows prebuilt binary returned 404 and source compilation
  failed. Local tooling was linked using `--ignore-scripts`. This is a local
  verification limitation, not an exception to the normal CI install.
- Full lint failed with 2 errors and 2,257 warnings. The errors are malformed JSX
  in `src/components/dashboard/AuditLog.tsx` and an unguarded transaction
  submission in `src/components/dashboard/AssetIssuanceWizard.tsx`.
- Both normal and strict type checks, and the production build, fail on the
  existing unclosed JSX in `AuditLog.tsx` (lines 406 and 770/771). Bundle and
  performance budgets cannot be evaluated until the build succeeds.
- Global formatting fails on `eslint.config.js`, `tsconfig.json`,
  `.github/workflows/ci.yml` and `.prettierrc.json`.
- Documentation drift reports 13 broken references in the existing ADRs and
  protocol upgrade tracker guide. None originate in the new guides.
- `check:package-manager` rejects Node 22, still demanding Node 18 or 20 even
  though `check:node`, `engines` and the main CI support Node 22/24/26.
- Full dependency audit reports 8 low, 42 moderate, 48 high and 7 critical
  findings. Applying the repository SLA evaluator to this full audit reports
  27 breaches and 62 warnings. CI's production-only audit must also be run;
  these full-audit numbers are not a production-only result.
- The existing Soroban Playwright test was attempted after installing Chromium;
  it fails waiting for the Contracts control to become available. The dev app
  also reports the existing JSX compilation error.
- Accessibility was attempted with one worker and a first-failure limit: 2 tests
  passed, the settings route failed `scrollable-region-focusable` at serious
  impact, and 5 tests did not run. The dev server also reported unresolved core
  package entry points. This is not a passing accessibility gate.
- An attempt to build the existing core package failed with TS6059: its test
  files are included outside `rootDir: src`. No core sources or configuration
  were changed; temporary compiler-generated test artifacts were removed.
- The broad Vitest run discovered 356 files and produced statuses for 354:
  236 passing files and 118 failing files. It then stopped making progress for
  more than two minutes with `tests/api/middleware/apiVersioning.test.js` and
  `src/components/dashboard/tests/ContractInteraction.test.tsx` unresolved. The
  owned Vitest process was terminated; there is no final suite summary or passing
  full-test result. Existing collection also includes tests under
  `mobile/node_modules`. A tracked learning-data file modified by the API tests
  was restored to its starting content.
- Coverage, visual/Lighthouse budgets, and remote security/governance workflows
  must pass before merge. `actionlint` was unavailable locally; the new workflow's
  YAML parsed successfully through Prettier, and execution still needs GitHub CI.

The full-suite command was
`pnpm exec vitest run --maxWorkers=2 --minWorkers=1`. Browser attempts used
`pnpm exec playwright test tests/e2e/soroban.spec.js --project=chromium --workers=1 --max-failures=1 --timeout=15000`
and
`pnpm exec playwright test --project=a11y --workers=1 --max-failures=1 --timeout=15000`.
The first-failure limit stops browser runs; it does not turn failures into a pass.

The lint/type/build/format/documentation files listed above were compared against
the starting upstream commit and are unchanged by this branch. Treat unrelated
repairs as focused follow-up changes; do not hide these failures behind the new
fixture workflow. Local diagnostic logs are under `reports/1187/` (ignored by
Git), with Playwright artifacts under `test-results/`.

## Security and review

Fixtures are explicitly synthetic testnet examples, not captured network data
or a statement about the current live protocol. No keys, credentials, captured
user data, signing, wallet writes or Stellar network requests are introduced.
Unknown metadata and network substitutions are rejected. The existing SDK and
TypeScript dependencies are reused. Hashes detect drift; they do not establish
signed authenticity. Review input and generated diffs together.

CI uses `pull_request`, read-only contents permissions and non-persisted checkout
credentials. It uploads reviewed refresh candidates without creating PRs or
writing branches. The workflow changes require code-owner review under the
existing CODEOWNERS policy; no such approval is claimed here.

The change adds contributor tooling and tests only. It introduces no UI controls,
accessibility behavior or production bundle imports. Existing browser,
accessibility, performance and security merge requirements remain applicable.
