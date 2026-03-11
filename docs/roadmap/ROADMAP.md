## Roadmap Snapshot (2026-03-11)

This roadmap reflects the current repository implementation state.

## Source Of Truth
- Product status and execution ordering: this file (`docs/roadmap/ROADMAP.md`).
- Runtime algorithms and scoring behavior: `docs/algorithms.md`.
- System and boundary model: `docs/architecture.md` and `docs/data-model.md`.
- Team process and quality gates: `docs/DEFINITION_OF_DONE.md`, `docs/sdlc.md`, `docs/pull_request_template.md`.
- Pending question-type and AI integration contract: `docs/IMPLEMENTATION_CONTRACTS.md`.

## NOW (Shipped / In Production Scope)
- Supabase Auth flow is implemented: signup, login, logout.
- Protected dashboard is implemented with per-topic progress cards.
- Topic unlock logic is implemented based on prerequisite completion.
- Progress calculation is implemented from micro-skill mastery averages.
- Learn flow is implemented for `MCQ` and `NUMERIC` question types.
- Learn submissions persist attempts and update mastery.
- End-to-end onboarding diagnostic is implemented (`/diagnostic`, 15 mixed `MCQ` + `NUMERIC` questions).
- Diagnostic completion is required before lesson access (`/learn/[topicId]` gating).
- Diagnostic sessions are persisted (`sessions.mode='DIAGNOSTIC'`, `attempts.session_id`, completion by `ended_at`).
- Difficulty-scaled mastery updates are implemented during diagnostic submissions.
- Supabase migrations, RLS policies, and `init_user_progress` RPC are in place.
- DB tooling is available: `npm run seed` and `npm run verify:db`.
- Test baseline exists:
  - Unit tests for grading/mastery and diagnostic selection logic.
  - Server-action integration-style tests for learn and diagnostic flows.

## NEXT (Current Priority)
- Implement `SETUP` question submission handling in learn and diagnostic flows.
- Implement `EXPLAIN` question submission handling.
- Wire OpenAI-backed explain-it-back feedback with canonical-solution grounding.
- Expand tests for new `SETUP`/`EXPLAIN` flows (unit + action tests).
- Add browser E2E coverage for the core journey: auth -> diagnostic -> dashboard -> learn.
- Add explicit error-state UX polish and user-facing messaging for common failures.

## Execution Order For Next Tranche
1. `SETUP` handlers (learn + diagnostic).
2. `EXPLAIN` handlers (learn + diagnostic).
3. OpenAI-grounded explain-it-back feedback.
4. Expanded tests (unit + action + error paths).
5. Core-journey browser E2E.
6. Error-state UX polish.

## LATER (Post-MVP Expansion)
- Spaced review scheduling and dedicated review-mode sessions.
- Rich analytics for misconception patterns and drop-off points.
- Teacher-facing dashboard and class-level analytics.
- Performance hardening and concurrency validation against non-functional goals.
