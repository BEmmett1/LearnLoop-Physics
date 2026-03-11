import { requestOpenAiExplainEvaluation } from "@/lib/ai/openai";

export type EvaluationState = "CORRECT" | "PARTIAL" | "INCORRECT" | "UNSCORABLE";
export type EvaluationSource = "RULES" | "AI";

export type TextEvaluation = {
  state: EvaluationState;
  reason: string;
  feedback: string;
  source: EvaluationSource;
  grounded_quotes?: string[];
  canonicalSolutionUsed?: boolean;
};

type SetupInput = {
  prompt: string;
  canonicalSolution: string;
  setupInput: string;
};

type ExplainInput = {
  prompt: string;
  canonicalSolution: string;
  explainInput: string;
};

const FEEDBACK_MAX = 240;
const VALID_STATES: EvaluationState[] = ["CORRECT", "PARTIAL", "INCORRECT", "UNSCORABLE"];

function normalizeText(text: string) {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}

function tokenize(text: string) {
  return normalizeText(text)
    .replace(/[^a-z0-9\s]/g, " ")
    .split(" ")
    .filter(Boolean);
}

function uniqueKeywords(text: string) {
  const blocked = new Set([
    "the",
    "and",
    "for",
    "with",
    "from",
    "that",
    "this",
    "into",
    "then",
    "when",
    "where",
    "your",
    "have",
    "will",
    "using",
    "about",
    "because",
    "there"
  ]);

  return Array.from(
    new Set(tokenize(text).filter(token => token.length >= 4 && !blocked.has(token)))
  );
}

function clampFeedback(feedback: string) {
  const trimmed = feedback.trim();
  if (!trimmed) return "Thanks for the response. Keep practicing this skill.";
  if (trimmed.length <= FEEDBACK_MAX) return trimmed;
  return `${trimmed.slice(0, FEEDBACK_MAX - 1).trimEnd()}…`;
}

export function isCorrectState(state: EvaluationState) {
  return state === "CORRECT";
}

export function fallbackExplainEvaluation(): TextEvaluation {
  return {
    state: "UNSCORABLE",
    reason: "ai_unavailable",
    feedback: "We could not evaluate this explanation right now. Please try again.",
    source: "RULES",
    canonicalSolutionUsed: false,
    grounded_quotes: []
  };
}

export function evaluateSetup(input: SetupInput): TextEvaluation {
  const setupText = input.setupInput.trim();
  if (!setupText) {
    return {
      state: "UNSCORABLE",
      reason: "empty_response",
      feedback: "Please provide your setup before submitting.",
      source: "RULES",
      canonicalSolutionUsed: true,
      grounded_quotes: []
    };
  }

  const canonicalKeywords = uniqueKeywords(input.canonicalSolution);
  const setupKeywords = new Set(uniqueKeywords(setupText));

  if (canonicalKeywords.length === 0) {
    return {
      state: "UNSCORABLE",
      reason: "missing_canonical_solution",
      feedback: "We could not evaluate this setup right now. Please try another question.",
      source: "RULES",
      canonicalSolutionUsed: false,
      grounded_quotes: []
    };
  }

  const overlap = canonicalKeywords.filter(word => setupKeywords.has(word)).length;
  const overlapScore = overlap / canonicalKeywords.length;

  const hasSetupSignals = /\b(given|find|solve|let|unknown|equation|velocity|acceleration|time|distance)\b/i.test(
    setupText
  );

  const finalScore = overlapScore + (hasSetupSignals ? 0.15 : 0);

  if (finalScore >= 0.65) {
    return {
      state: "CORRECT",
      reason: "setup_aligned",
      feedback: "Strong setup. Your plan matches the canonical method.",
      source: "RULES",
      canonicalSolutionUsed: true,
      grounded_quotes: canonicalKeywords.slice(0, 2)
    };
  }

  if (finalScore >= 0.35) {
    return {
      state: "PARTIAL",
      reason: "setup_partial",
      feedback: "You have part of the setup, but key steps or variables are missing.",
      source: "RULES",
      canonicalSolutionUsed: true,
      grounded_quotes: canonicalKeywords.slice(0, 2)
    };
  }

  return {
    state: "INCORRECT",
    reason: "setup_mismatch",
    feedback: "This setup does not align with the canonical approach yet.",
    source: "RULES",
    canonicalSolutionUsed: true,
    grounded_quotes: canonicalKeywords.slice(0, 2)
  };
}

export function parseAndValidateExplainOutput(raw: unknown): TextEvaluation {
  const state = typeof raw === "object" && raw ? (raw as any).state : null;
  const reason = typeof raw === "object" && raw ? (raw as any).reason : null;
  const feedback = typeof raw === "object" && raw ? (raw as any).feedback : null;
  const groundedQuotes = typeof raw === "object" && raw ? (raw as any).grounded_quotes : null;

  if (typeof state !== "string" || !VALID_STATES.includes(state as EvaluationState)) {
    throw new Error("invalid_state");
  }

  if (typeof reason !== "string" || !reason.trim()) {
    throw new Error("invalid_reason");
  }

  if (typeof feedback !== "string" || !feedback.trim()) {
    throw new Error("invalid_feedback");
  }

  const quotes = Array.isArray(groundedQuotes)
    ? groundedQuotes.filter((quote): quote is string => typeof quote === "string").slice(0, 3)
    : [];

  return {
    state: state as EvaluationState,
    reason: reason.trim(),
    feedback: clampFeedback(feedback),
    source: "AI",
    grounded_quotes: quotes,
    canonicalSolutionUsed: true
  };
}

export async function evaluateExplain(input: ExplainInput): Promise<TextEvaluation> {
  const explainText = input.explainInput.trim();
  if (!explainText) {
    return {
      state: "UNSCORABLE",
      reason: "empty_response",
      feedback: "Please provide your explanation before submitting.",
      source: "RULES",
      canonicalSolutionUsed: true,
      grounded_quotes: []
    };
  }

  if (!input.canonicalSolution.trim()) {
    return fallbackExplainEvaluation();
  }

  try {
    const raw = await requestOpenAiExplainEvaluation({
      prompt: input.prompt,
      canonicalSolution: input.canonicalSolution,
      explainInput: explainText
    });

    return parseAndValidateExplainOutput(raw);
  } catch {
    return fallbackExplainEvaluation();
  }
}

