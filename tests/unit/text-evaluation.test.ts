import { describe, expect, it, vi } from "vitest";

const { requestOpenAiExplainEvaluationMock } = vi.hoisted(() => ({
  requestOpenAiExplainEvaluationMock: vi.fn()
}));

vi.mock("@/lib/ai/openai", () => ({
  requestOpenAiExplainEvaluation: requestOpenAiExplainEvaluationMock
}));

import {
  evaluateExplain,
  evaluateSetup,
  fallbackExplainEvaluation,
  isCorrectState,
  parseAndValidateExplainOutput
} from "@/lib/learning/text-evaluation";

describe("evaluateSetup", () => {
  it("maps strong setup to CORRECT", () => {
    const result = evaluateSetup({
      prompt: "Find velocity.",
      canonicalSolution: "Given distance and time, use velocity equation v = d/t.",
      setupInput: "Given distance and time, I will use the velocity equation v=d/t to solve."
    });

    expect(result.state).toBe("CORRECT");
    expect(isCorrectState(result.state)).toBe(true);
  });

  it("maps medium overlap to PARTIAL", () => {
    const result = evaluateSetup({
      prompt: "Find velocity.",
      canonicalSolution: "Given distance and time, use velocity equation v = d/t.",
      setupInput: "I know distance and maybe an equation but I need to identify the unknown."
    });

    expect(result.state).toBe("PARTIAL");
  });

  it("maps weak overlap to INCORRECT", () => {
    const result = evaluateSetup({
      prompt: "Find velocity.",
      canonicalSolution: "Given distance and time, use velocity equation v = d/t.",
      setupInput: "I will draw a random chart unrelated to this problem."
    });

    expect(result.state).toBe("INCORRECT");
  });

  it("returns UNSCORABLE for blank setup", () => {
    const result = evaluateSetup({
      prompt: "Find velocity.",
      canonicalSolution: "Given distance and time, use velocity equation v = d/t.",
      setupInput: "   "
    });

    expect(result.state).toBe("UNSCORABLE");
    expect(result.reason).toBe("empty_response");
  });
});

describe("parseAndValidateExplainOutput", () => {
  it("accepts valid explain output", () => {
    const parsed = parseAndValidateExplainOutput({
      state: "PARTIAL",
      reason: "missing_concept",
      feedback: "You identified one concept but missed acceleration.",
      grounded_quotes: ["use acceleration equation"]
    });

    expect(parsed.state).toBe("PARTIAL");
    expect(parsed.source).toBe("AI");
    expect(parsed.canonicalSolutionUsed).toBe(true);
  });

  it("rejects invalid state", () => {
    expect(() =>
      parseAndValidateExplainOutput({
        state: "UNKNOWN",
        reason: "bad",
        feedback: "bad"
      })
    ).toThrowError("invalid_state");
  });

  it("rejects missing fields", () => {
    expect(() => parseAndValidateExplainOutput({ state: "CORRECT" })).toThrow();
  });
});

describe("evaluateExplain", () => {
  it("returns parsed AI evaluation when output is valid", async () => {
    requestOpenAiExplainEvaluationMock.mockResolvedValue({
      state: "CORRECT",
      reason: "conceptual_match",
      feedback: "Great conceptual explanation.",
      grounded_quotes: ["velocity changes linearly"]
    });

    const result = await evaluateExplain({
      prompt: "Why does velocity increase?",
      canonicalSolution: "Velocity increases linearly when acceleration is constant.",
      explainInput: "Because acceleration is constant, velocity changes by equal amounts each second."
    });

    expect(result.state).toBe("CORRECT");
    expect(result.source).toBe("AI");
  });

  it("falls back when AI throws", async () => {
    requestOpenAiExplainEvaluationMock.mockRejectedValue(new Error("timeout"));

    const result = await evaluateExplain({
      prompt: "Why does velocity increase?",
      canonicalSolution: "Velocity increases linearly when acceleration is constant.",
      explainInput: "I think acceleration affects velocity over time."
    });

    expect(result).toEqual(fallbackExplainEvaluation());
  });

  it("falls back on invalid AI shape", async () => {
    requestOpenAiExplainEvaluationMock.mockResolvedValue({ foo: "bar" });

    const result = await evaluateExplain({
      prompt: "Why does velocity increase?",
      canonicalSolution: "Velocity increases linearly when acceleration is constant.",
      explainInput: "Because acceleration adds velocity over time."
    });

    expect(result.reason).toBe("ai_unavailable");
    expect(result.state).toBe("UNSCORABLE");
  });
});

