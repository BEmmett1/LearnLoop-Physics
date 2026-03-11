export function clamp01(n: number) {
  return Math.max(0, Math.min(1, n));
}

// Simple mastery update rule (MVP)
// correct: move toward 1
// incorrect: move toward 0
export function updateMasteryScore(oldScore: number, correct: boolean) {
  const s = clamp01(oldScore);
  if (correct) return clamp01(s + 0.12 * (1 - s));
  return clamp01(s - 0.12 * s);
}

export function gradeMcqAnswer(
  selectedChoiceIndex: number | null,
  correctChoiceIndex: number | null
) {
  return (
    selectedChoiceIndex !== null &&
    correctChoiceIndex !== null &&
    selectedChoiceIndex === correctChoiceIndex
  );
}

export function gradeNumericAnswer(
  input: number | null,
  answer: number | null,
  tolerance: number | null
) {
  if (input === null || answer === null) return false;
  const t = tolerance ?? 0;
  return Math.abs(input - answer) <= t;
}
