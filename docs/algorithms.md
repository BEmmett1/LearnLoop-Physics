# Adaptive Learning Algorithms

This document reflects current implementation behavior in `src/lib/learning/grading.ts`
and `src/lib/learning/diagnostic.ts`.

## Mastery Model
- Mastery is tracked per micro-skill.
- Score range is `0.0` to `1.0`.
- Scores are clamped into `[0, 1]` after each update.
- If no prior score is available in context, `0.3` is used as the practical default.

## Learn-Mode Mastery Update
Applied by learn submission actions (`MCQ`, `NUMERIC`; later `SETUP`, `EXPLAIN`):

- Let `s = clamp01(oldScore)`.
- If correct: `new = clamp01(s + 0.12 * (1 - s))`.
- If incorrect: `new = clamp01(s - 0.12 * s)`.

This is a proportional update, not a fixed delta.

## Diagnostic Mastery Update
Diagnostic uses the same proportional structure with a difficulty multiplier:

- Base delta: `0.12`
- Difficulty multiplier:
  - Difficulty `1` -> `1.00`
  - Difficulty `2` -> `1.25`
  - Difficulty `3` -> `1.50`
- Effective delta: `baseDelta * multiplier`
- Update:
  - Correct: `new = clamp01(s + effectiveDelta * (1 - s))`
  - Incorrect: `new = clamp01(s - effectiveDelta * s)`

## Diagnostic Question Selection (Current)
- Eligible pool includes `MCQ`, `NUMERIC`, `SETUP`, and `EXPLAIN`.
- Target count is `15` questions (or fewer if the pool is smaller).
- Selection loop:
1. Cycle preferred difficulty in order `1 -> 2 -> 3`.
2. Within candidate set, prefer question with highest uncovered micro-skill gain.
3. Tie-break by lower difficulty.
4. Final tie-break by lexicographic `id`.

## Learn Question Selection (Current)
Within a topic, the next question is selected by sorting:
1. Lowest attempt count first.
2. Lowest weakness score first (minimum mastery across the question's micro-skills).
3. Lowest difficulty first.

## Future Algorithms (Not Yet Implemented)
- Spaced review scheduling.
- Review-mode session policy.


