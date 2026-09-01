# Luxora selective CI

Luxora CI chooses checks from the files changed in each push or pull request. The selector is deterministic and fails closed: an unknown path, unavailable Git comparison, workflow change, classifier change, or large refactor runs the full validation set.

The selector lives in `scripts/ci/plan-checks.mjs`. Its unit tests live beside it in `scripts/ci/plan-checks.test.mjs`.

## Always-run checks

Every run checks out full Git history, classifies the change, and runs Gitleaks. A final job named `validate-and-test` succeeds only when every selected job passes. Use `Luxora CI / validate-and-test` as the stable branch-protection check.

## Check selection

| Change | Selected validation |
| --- | --- |
| Documentation only | Classification, Gitleaks, final gate |
| Frontend | Lint and production frontend build |
| Normal backend | Lint and the backend smoke suite |
| Booking/provider work | Booking suite |
| Payments, refunds, subscriptions, promotions | Payment and security suites plus Docker smoke |
| Authentication, uploads, storage, KYC, bank data | Security and smoke suites plus Docker smoke |
| Prisma files | Full backend suite, database coverage, and Docker smoke |
| Docker files | Production Docker build and health check |
| Dependency lockfiles | Affected checks and production dependency audit |
| CI rules, classifier, unknown source area, or large refactor | Full validation |
| Knowledge Graph only | Gitleaks here; generation and publication remain in the separate Knowledge Graph workflow |

For a mixed commit, the selector combines every required check. Renames inspect both the old and new paths so moving a critical source file into a documentation folder cannot reduce coverage.

## Backend suites

```powershell
npm --prefix backend run test:smoke
npm --prefix backend run test:payments
npm --prefix backend run test:bookings
npm --prefix backend run test:security
npm --prefix backend test
```

Each suite resets only the local `luxora_test` schema, applies committed migrations, seeds it, runs serially against isolated ports, and closes its child servers and Prisma clients. The runner refuses non-local database hosts.

## Full validation

Manual workflow runs and the daily scheduled run select the complete validation set. Full validation also runs automatically for changes to workflows, CI classification, shared root dependencies, unrecognized source areas, and change sets larger than 30 files.

## Maintaining the classifier

When adding a major top-level area such as `worker/` or `mobile/`:

1. Add an explicit rule to `plan-checks.mjs`.
2. Add classifier tests for normal, deleted, and renamed files.
3. Map its critical tests to a named suite.
4. Confirm unknown paths still select full CI.
5. Run `npm run test:ci-plan`.

The Knowledge Graph may later broaden affected test selection, but it must never remove checks selected by these static safety rules.

## Time and failure limits

Conditional jobs run in parallel where useful. Backend and Docker jobs have seven-minute limits, lint/frontend has five minutes, audits have four minutes, and classification has three minutes. New pushes cancel older runs for the same event and branch or pull request.
