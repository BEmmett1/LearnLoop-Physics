## NOW
- End-to-end onboarding diagnostic flow (15-question mixed MCQ/NUMERIC run)
- Route gating: diagnostic required before `/learn/[topicId]`
- Diagnostic session persistence (`sessions.mode='DIAGNOSTIC'`, `attempts.session_id`, completion by `ended_at`)
- Difficulty-scaled mastery updates during diagnostic
- Unit and action tests for diagnostic selection and submission/finalization

## NEXT
- Implement `SETUP` submission handling and grading feedback
- Implement `EXPLAIN` submission handling with canonical-solution-grounded AI feedback
- Add browser E2E tests for auth -> diagnostic -> dashboard -> learn journey

## LATER
- Spaced review scheduling and review-mode sessions
- Teacher-facing dashboard and class-level analytics
- Rich analytics for misconception trends and drop-off points
