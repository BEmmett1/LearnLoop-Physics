# Decision Log (ADR Style)

Track architecture and process decisions in append-only format.

## ADR-001: Mastery Algorithm Source Of Truth
- Date: 2026-03-11
- Status: Accepted
- Decision: Treat current runtime mastery behavior as source of truth and align docs to code.
- Rationale: Existing tests and behavior already rely on proportional mastery updates and diagnostic difficulty multipliers.
- Consequences:
  - `docs/algorithms.md` must reflect runtime formulas.
  - Future mastery changes require explicit ADR + test updates.

## ADR-002: Iteration Priority Is Docs/Process Foundation First
- Date: 2026-03-11
- Status: Accepted
- Decision: Complete docs/process alignment before implementing pending `SETUP`/`EXPLAIN` runtime changes.
- Rationale: Current gaps were primarily specification drift and missing planning artifacts.
- Consequences:
  - Work starts with contract/spec and process docs.
  - Feature implementation starts only after contract acceptance.

## ADR-003: No Schema Migration In Docs/Foundation Iteration
- Date: 2026-03-11
- Status: Accepted
- Decision: Avoid database migrations during docs/process iteration unless a blocking gap is found.
- Rationale: Current `attempts.response` JSON structure can hold text-response evaluation metadata without schema changes.
- Consequences:
  - Pending features will store richer payloads in `attempts.response`.
  - Any later schema hardening requires a new migration and ADR.

## ADR-004: Explain Feedback Requires Canonical Grounding + Deterministic Fallback
- Date: 2026-03-11
- Status: Accepted
- Decision: `EXPLAIN` feedback must be grounded in `canonical_solution` and degrade to deterministic fallback if AI is unavailable.
- Rationale: Prevents hallucinated authoritative content and keeps learner flow reliable.
- Consequences:
  - Prompt/output contract is mandatory for implementation.
  - Tests must validate fallback behavior and error handling.
