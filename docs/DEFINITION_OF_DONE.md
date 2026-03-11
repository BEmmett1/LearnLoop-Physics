# Definition Of Done (DoD)

Use this checklist for each feature, bugfix, or refactor before merge.

## Metadata

- Work item / issue:
- PR link:
- Owner:
- Date:
- Type: Feature / Bugfix / Refactor / Docs / Infra

## 1) Requirements Done

- [ ] Problem statement is clear and user-facing impact is documented.
- [ ] Acceptance criteria are explicit and testable.
- [ ] Scope and non-goals are documented.
- [ ] Dependencies and assumptions are listed.

Notes:

## 2) Design And Architecture Done

- [ ] Proposed approach is documented (short design note in PR or docs).
- [ ] Data model/API changes are identified.
- [ ] Security/privacy implications are reviewed (auth, RLS, secrets, PII).
- [ ] Backward compatibility impact is reviewed.

Notes:

## 3) Implementation Done

- [ ] Code is complete and aligned to acceptance criteria.
- [ ] Error paths and edge cases are handled.
- [ ] Migrations are append-only (no edits to already-applied files).
- [ ] Feature flags or rollout controls are added if risk requires them.

Notes:

## 4) Testing Done

- [ ] Unit tests added/updated for changed logic.
- [ ] Integration/server-action tests added/updated as needed.
- [ ] Manual test scenarios executed for user-critical flows.
- [ ] `npm run test` passes locally.
- [ ] `npm run build` passes locally.

Optional quality gates:

- [ ] `npm run test:coverage` reviewed.
- [ ] Coverage threshold met (if enforced).

Notes:

## 5) CI/CD Done

- [ ] CI checks pass on PR.
- [ ] Required status checks are enabled for `main`.
- [ ] Branch protection is enabled (PR review + passing checks).
- [ ] Deployment plan is defined (preview + production).
- [ ] Rollback strategy is documented.

Notes:

## 6) Documentation Done

- [ ] README updated if setup/scripts/behavior changed.
- [ ] Relevant docs in `docs/` updated (architecture, data model, SDLC, migrations).
- [ ] Changelog/release notes updated (if applicable).

Updated docs:

## 7) Release And Post-Merge Done

- [ ] Monitoring/alerts considered for the changed area.
- [ ] Known risks and follow-up tasks are tracked.
- [ ] Ownership for post-release verification is assigned.

Post-merge checks:

## Sign-off

- Engineering:
- Reviewer:
- Product (if required):
- QA (if required):
