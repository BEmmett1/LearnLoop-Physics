# Project Timeline

## 2026-03-11 - Baseline Captured
- Roadmap snapshot recorded current shipped scope:
  - Auth, dashboard, topic unlock, progress calculation.
  - Learn submissions for `MCQ` and `NUMERIC`.
  - Diagnostic flow with 15-question session and completion gating.
  - Difficulty-scaled mastery updates in diagnostic.

## 2026-03-11 - Docs/Process Foundation Iteration Started
- Normalized docs so behavior/status claims are consistent across roadmap, requirements, architecture, and algorithms.
- Added explicit source-of-truth mapping for product behavior vs process controls.
- Created implementation contract for pending `SETUP`/`EXPLAIN` and OpenAI explain feedback.
- Filled missing history/process artifacts:
  - ADR-style decisions log.
  - Iteration planning template.

## Next Milestones (Queued)
1. Implement `SETUP` handlers in learn and diagnostic.
2. Implement `EXPLAIN` handlers in learn and diagnostic.
3. Integrate canonical-grounded OpenAI explain feedback.
4. Expand unit and server-action tests for new flows.
5. Add browser E2E for auth -> diagnostic -> dashboard -> learn.
6. Polish error-state UX and user messaging.
