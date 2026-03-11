import { describe, expect, it } from "vitest";
import {
  diagnosticDifficultyMultiplier,
  DIAGNOSTIC_QUESTION_LIMIT,
  selectDiagnosticQuestions,
  updateMasteryScoreWithDifficulty
} from "@/lib/learning/diagnostic";

describe("diagnosticDifficultyMultiplier", () => {
  it("returns expected multipliers", () => {
    expect(diagnosticDifficultyMultiplier(1)).toBe(1);
    expect(diagnosticDifficultyMultiplier(2)).toBe(1.25);
    expect(diagnosticDifficultyMultiplier(3)).toBe(1.5);
  });
});

describe("updateMasteryScoreWithDifficulty", () => {
  it("applies stronger positive delta at higher difficulty", () => {
    const easy = updateMasteryScoreWithDifficulty(0.3, true, 1);
    const hard = updateMasteryScoreWithDifficulty(0.3, true, 3);
    expect(hard).toBeGreaterThan(easy);
  });

  it("applies stronger negative delta at higher difficulty", () => {
    const easy = updateMasteryScoreWithDifficulty(0.7, false, 1);
    const hard = updateMasteryScoreWithDifficulty(0.7, false, 3);
    expect(hard).toBeLessThan(easy);
  });

  it("keeps results clamped", () => {
    expect(updateMasteryScoreWithDifficulty(1, true, 3)).toBe(1);
    expect(updateMasteryScoreWithDifficulty(0, false, 3)).toBe(0);
  });
});

describe("selectDiagnosticQuestions", () => {
  it("returns up to 15 unique questions with mixed difficulty when available", () => {
    const types = ["MCQ", "NUMERIC", "SETUP", "EXPLAIN"] as const;
    const questions = Array.from({ length: 18 }).map((_, idx) => {
      const difficulty = ((idx % 3) + 1) as 1 | 2 | 3;
      return {
        id: `q-${idx + 1}`,
        type: types[idx % types.length],
        difficulty,
        micro_skill_ids: [`MS-${(idx % 6) + 1}`]
      };
    });

    const selected = selectDiagnosticQuestions(questions as any[]);

    expect(selected).toHaveLength(DIAGNOSTIC_QUESTION_LIMIT);
    expect(new Set(selected.map(q => q.id)).size).toBe(selected.length);

    const difficulties = new Set(selected.map(q => q.difficulty));
    expect(difficulties.has(1)).toBe(true);
    expect(difficulties.has(2)).toBe(true);
    expect(difficulties.has(3)).toBe(true);
  });

  it("returns all supported types", () => {
    const selected = selectDiagnosticQuestions([
      { id: "q-1", type: "SETUP", difficulty: 1, micro_skill_ids: ["MS-1"] },
      { id: "q-2", type: "EXPLAIN", difficulty: 2, micro_skill_ids: ["MS-2"] },
      { id: "q-3", type: "MCQ", difficulty: 3, micro_skill_ids: ["MS-3"] },
      { id: "q-4", type: "NUMERIC", difficulty: 1, micro_skill_ids: ["MS-4"] }
    ] as any[]);

    expect(selected.map(q => q.type).sort()).toEqual(["EXPLAIN", "MCQ", "NUMERIC", "SETUP"]);
  });
});

