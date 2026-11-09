# Luxora local readiness review — 2026-11-05

## Clean-install follow-up — passed

Three independent lockfile installations completed under explicit Node 22.23.2. All six package manifests and lockfiles stayed unchanged. Dependency resolution was verified inside each fresh dependency directory, with external module/preload overrides cleared during verification. Installation used `npm ci --ignore-scripts --no-audit --no-fund`, followed by explicit Prisma Client generation. No original node_modules directories were reused.

The fresh environment passed all 353 tests (299 backend including Redis/distributed, 8 frontend, 37 CI-planning, 9 graph-rendering), lint, frontend build and graph validation. API health returned HTTP 200. Recovery again verified 46 frontend files and matching row counts for 26 restored database tables. Temporary services stopped; original source files and pre-existing Git changes were preserved.

The earlier storage and linked-dependency limitations below are historical and superseded by this follow-up. Evidence: `Brainweb/Evidence/2026-11-05 Luxora Clean Install/` in the Blews workspace. No live cloud integrations or owner proficiency are established by these checks.

## Scope and selection

Assessment checkout: `C:\Users\4Raisan\Desktop\MIII\Personal Projects\Big Fish\Luxora_v1`. Branch `main`, HEAD `d8f9b28f3fc77895fb373c7243e13609dae7c64a`, with 53 pre-existing working-tree entries at snapshot time. This is the evidence-backed assessment focus, not an owner-confirmed declaration of the canonical checkout. The divergent `Music/Luxora` copy remains untouched.

README.md and AGENTS.md describe a Sri Lankan home-concierge platform for Auto Care, Garden Care and Pet Care. Brainweb's older music-platform description was stale. The source-derived graph contains 237 nodes and 614 edges; relevant paths include frontend API client → route/middleware → services → Prisma models. The existing graph is navigation evidence, not a runtime trace.

## Verified results

| Check | Result |
|---|---|
| Runtime | Explicit Node 22.23.2 executable; disposable PostgreSQL 16.15 |
| Frontend unit tests | 8 passed, 0 failed |
| CI selection and protected-file tests | 37 passed, 0 failed |
| Graph rendering tests | 9 passed, 0 failed |
| Backend discovery run | 299 passed, 0 failed, 0 skipped; Redis/distributed checks included |
| Lint | Exit 0 |
| Production frontend build | Exit 0 |
| Knowledge/architecture graph generation and validation | Exit 0; regenerated only in the assessment copy |
| Local API startup | `/api/health` returned HTTP 200 with database up |
| Frontend recovery | 46 files archived, extracted, hash-verified and served over loopback |
| Database recovery | Custom-format dump restored into a second disposable database; exact row counts matched for 26 tables |
| Cleanup | Owned temporary API, static server and PostgreSQL stopped |
| Source preservation | All 442 copied source-file hashes matched the original; Git status matched the pre-check snapshot before this report was added |

The initial PostgreSQL-only run had three skips. A subsequent run against a separate loopback Ubuntu Redis 7.0.15 instance passed all 299 backend tests with no skips. The owned Redis instance was shut down afterwards. No production data or account credentials were used. The local lab used generated ephemeral secrets and a loopback-only database.

## What this establishes

The inspected working snapshot can build and pass the exercised checks using installed dependencies, start locally against a fresh migration-built database, and recover a frontend artifact and disposable database dump. Existing dependency directories were linked read-only for use by the isolated source copy. This first pass did not perform a clean lockfile reinstall. The follow-up above establishes independent dependency installation for the same assessment snapshot; clean OS and hosted checks remain outside scope. The tests were executed by the assistant; they do not independently assess the owner's contribution or ability.

## Remaining tasks in order

1. **Fresh-install proof completed:** three independent installs and explicit Prisma generation passed the verification suite. The historical disk blocker is resolved.
2. **Distributed validation completed:** existing Ubuntu Redis 7.0.15 supplied a disposable loopback instance; all applicable cases passed without skips.
3. **Local-to-hosted parity:** choose the intended legacy or distributed topology; compare runtime version, database version, migration policy, health checks, storage and scheduler behavior. Do not combine both deployment paths by assumption.
4. **External rehearsal:** use authorized sandbox accounts for actual callback delivery, email, object storage persistence and identity-provider login. Local mocked checks do not establish them.
5. **Portfolio explanation:** owner records their contribution and explains request flow, authorization, persistence, backup recovery and one design trade-off. Attach that demonstration before upgrading personal skill ratings.

No target completion dates or cloud budget were inferred. Current semester, academic deadlines and course completion remain unconfirmed.

## Evidence and replay

Evidence bundle: `C:\Users\4Raisan\Desktop\Blews\Brainweb\Evidence\2026-11-05 Luxora`. Full disposable laboratory: `C:\Users\4Raisan\Documents\Brainweb Verification\20261105-152859`. Source snapshot hashes are in `source-manifest.json`; check commands and redacted outputs are retained in the evidence bundle. Database dumps and generated secrets are not included in Brainweb's evidence bundle.

From `Blews`, the existing lab can be replayed with:

```powershell
python tools/run_project_checks.py frontend-tests
python tools/run_project_checks.py ci-tests
python tools/run_project_checks.py graph-tests
python tools/run_project_checks.py lint
python tools/run_project_checks.py build
python tools/run_project_checks.py graph-verify
python tools/prepare_portable_postgres.py
python tools/run_local_database_rehearsal.py --with-redis
python tools/verify_frontend_artifact.py
```

These commands use the frozen snapshot identified by `tools/verification-current.json`; they do not resnapshot later source changes. The portable PostgreSQL runtime was removed after verification to reclaim space; the preparation command downloads it again. Database clusters and the extracted frontend recovery directory were also removed. Verified archives, source snapshot and evidence remain. The database command creates and stops a new local cluster each run. The frontend check serves static files over loopback; it is not a browser interaction test.

PostgreSQL runtime source: [EDB official binary archives](https://www.enterprisedb.com/download-postgresql-binaries). Runtime files were fetched from the official HTTPS ZIP and checked by ZIP CRC during extraction; an independent vendor checksum was not established by this workflow.
