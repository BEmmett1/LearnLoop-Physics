import { describe, expect, it } from "vitest";
import {
  clamp01,
  gradeNumericAnswer,
  updateMasteryScore
} from "@/lib/learning/grading";

describe("clamp01", () => {
  it("clamps below 0", () => {
    expect(clamp01(-0.2)).toBe(0);
  });

  it("clamps above 1", () => {
    expect(clamp01(1.2)).toBe(1);
  });

  it("keeps values in range", () => {
    expect(clamp01(0.42)).toBe(0.42);
  });
});

describe("updateMasteryScore", () => {
  it("increases score when correct", () => {
    expect(updateMasteryScore(0.5, true)).toBeCloseTo(0.56, 6);
  });

  it("decreases score when incorrect", () => {
    expect(updateMasteryScore(0.5, false)).toBeCloseTo(0.44, 6);
  });

  it("never exceeds bounds", () => {
    expect(updateMasteryScore(1, true)).toBe(1);
    expect(updateMasteryScore(0, false)).toBe(0);
  });
});

describe("gradeNumericAnswer", () => {
  it("supports exact match with zero tolerance", () => {
    expect(gradeNumericAnswer(25, 25, 0)).toBe(true);
    expect(gradeNumericAnswer(24.99, 25, 0)).toBe(false);
  });

  it("accepts values at tolerance edge", () => {
    expect(gradeNumericAnswer(24.5, 25, 0.5)).toBe(true);
    expect(gradeNumericAnswer(25.5, 25, 0.5)).toBe(true);
  });

  it("returns false when input or answer is missing", () => {
    expect(gradeNumericAnswer(null, 25, 0.5)).toBe(false);
    expect(gradeNumericAnswer(25, null, 0.5)).toBe(false);
  });
});
