# Adaptive Learning Algorithms

## Mastery Model
- Mastery tracked per micro-skill
- Score range: 0.0 to 1.0

### Update Rules
- Correct (fast): +0.12
- Correct (slow): +0.08
- Incorrect: −0.06
- Hint penalty: −0.04
- Clamp to [0.0, 1.0]

---

## Diagnostic Scoring
- Serve 15 mixed questions
- Initialize mastery based on correctness and difficulty
- Default mastery = 0.3 if no data

---

## Question Selection
1. Identify lowest mastery micro-skill
2. Filter questions matching that skill
3. Prefer unseen, easy/medium difficulty
4. Occasionally inject:
   - Word problems
   - Explain-it-back questions

---

## Spaced Review (Future)
- Incorrect → review next session
- Correct → delay review proportional to mastery
