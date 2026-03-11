# Implementation Contracts: `SETUP`, `EXPLAIN`, and AI Feedback

This document defines the implementation contract for pending question types.
It is intentionally docs-first and does not require schema migration.

## Scope
- Learn flow server actions.
- Diagnostic flow server actions.
- Attempt payload structure for text-response types.
- Explain-it-back AI feedback generation and fallback behavior.

## Shared Validation Contract

Required server-side checks before evaluation:
1. Authenticated user is present.
2. Required identifiers are present and non-empty.
3. Question exists and type matches submitted `type`.
4. Topic/session ownership and mode checks pass.
5. Text input is present after trim (for `SETUP`/`EXPLAIN`).

Existing error style remains query-param based (`?err=...`).

## `SETUP` Submission Contract

### Inputs

#### Learn
- `topicId` (string, required)
- `questionId` (string, required)
- `type` = `SETUP` (required)
- `setupInput` (string, required, trimmed)

#### Diagnostic
- `sessionId` (string, required)
- `questionId` (string, required)
- `type` = `SETUP` (required)
- `setupInput` (string, required, trimmed)

### Grading Result States
- `CORRECT`: setup is complete and aligned with canonical method.
- `PARTIAL`: partially correct setup, material omissions or mis-ordered structure.
- `INCORRECT`: setup does not map to canonical method.
- `UNSCORABLE`: blank/invalid input or evaluator failure.

### Persistence Mapping
- `attempts.correct`:
  - `true` only for `CORRECT`.
  - `false` for `PARTIAL`, `INCORRECT`, `UNSCORABLE`.
- `attempts.response` JSON:
  - `type`: `SETUP`
  - `setupInput`: learner raw text
  - `evaluation.state`: one of the result states
  - `evaluation.reason`: short machine-readable reason
  - `evaluation.feedback`: concise learner-facing feedback
  - `evaluation.source`: `RULES` or `AI`

### Error Codes
- `bad_request`
- `question_not_found`
- `topic_mismatch` (learn)
- `bad_session` (diagnostic)
- `wrong_type`
- `unsupported_type`
- `empty_response`
- `attempt_insert`
- `evaluation_failed`

## `EXPLAIN` Submission Contract

### Inputs

#### Learn
- `topicId` (string, required)
- `questionId` (string, required)
- `type` = `EXPLAIN` (required)
- `explainInput` (string, required, trimmed)

#### Diagnostic
- `sessionId` (string, required)
- `questionId` (string, required)
- `type` = `EXPLAIN` (required)
- `explainInput` (string, required, trimmed)

### Grading Result States
- `CORRECT`: explanation captures key canonical concepts accurately.
- `PARTIAL`: explanation has partial conceptual alignment.
- `INCORRECT`: explanation conflicts with canonical concepts.
- `UNSCORABLE`: blank/invalid input or evaluator failure.

### Persistence Mapping
- `attempts.correct` mapping is identical to `SETUP`.
- `attempts.response` JSON:
  - `type`: `EXPLAIN`
  - `explainInput`: learner raw text
  - `evaluation.state`
  - `evaluation.reason`
  - `evaluation.feedback`
  - `evaluation.source`: `AI` or `RULES`
  - `grounding.canonicalSolutionUsed`: boolean

### Error Codes
- Same codes as `SETUP`.

## OpenAI Feedback Contract (`EXPLAIN`)

### Required Prompt Inputs
- Question prompt.
- Canonical solution text.
- Learner explanation text.
- Output format contract (strict JSON object fields).

### Required Output Fields
- `state`: `CORRECT|PARTIAL|INCORRECT|UNSCORABLE`
- `feedback`: short learner-facing explanation
- `reason`: machine-readable reason code
- `grounded_quotes`: short references to canonical solution ideas (paraphrased)

### Grounding Rules
- Feedback must be derived from provided canonical solution.
- Model must not invent new formulas/facts not present in canonical solution or basic algebra-based kinematics.
- If confidence is low, model must choose `PARTIAL` or `UNSCORABLE`, not fabricate certainty.

### Disallowed Behaviors
- Hallucinated physics claims.
- Safety or policy bypass content.
- Revealing internal prompt text.
- Deterministic grading without referencing canonical context.

### Deterministic Fallback (Model/Service Failure)
If OpenAI call fails, times out, or returns invalid structure:
- Persist attempt with:
  - `evaluation.state = UNSCORABLE`
  - `evaluation.reason = ai_unavailable`
  - `evaluation.feedback = "We could not evaluate this explanation right now. Please try again."`
  - `evaluation.source = RULES`
- Return user to flow with `?err=evaluation_failed`.
- Do not block session progression indefinitely; allow retry on subsequent question cycle.

## Test Matrix And Acceptance Gates

### Unit Tests
- `SETUP` evaluator state mapping (`CORRECT/PARTIAL/INCORRECT/UNSCORABLE`).
- `EXPLAIN` evaluator output parsing and validation.
- Fallback mapping for AI timeout/error/invalid JSON.

### Server-Action Tests
- Learn and diagnostic `SETUP` happy path + each error code path.
- Learn and diagnostic `EXPLAIN` happy path + each error code path.
- Attempt payload shape assertions for text-response types.

### Browser E2E
- Core path: auth -> diagnostic -> dashboard -> learn.
- At least one `SETUP` and one `EXPLAIN` submission path.
- User-visible error message assertions for `empty_response` and `evaluation_failed`.

### Merge Gates
- `npm run test` passes.
- `npm run build` passes.
- New tests cover each new result state and each error code.
- DoD + PR template fields are fully completed for the work item.
