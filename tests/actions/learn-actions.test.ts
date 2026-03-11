import { beforeEach, describe, expect, it, vi } from "vitest";

class RedirectError extends Error {
  url: string;

  constructor(url: string) {
    super(`Redirect: ${url}`);
    this.url = url;
  }
}

const {
  redirectMock,
  createSupabaseServerClientMock,
  evaluateSetupMock,
  evaluateExplainMock
} = vi.hoisted(() => ({
  redirectMock: vi.fn((url: string) => {
    throw new RedirectError(url);
  }),
  createSupabaseServerClientMock: vi.fn(),
  evaluateSetupMock: vi.fn(),
  evaluateExplainMock: vi.fn()
}));

vi.mock("next/navigation", () => ({
  redirect: redirectMock
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: createSupabaseServerClientMock
}));

vi.mock("@/lib/learning/text-evaluation", () => ({
  evaluateSetup: evaluateSetupMock,
  evaluateExplain: evaluateExplainMock,
  isCorrectState: (state: string) => state === "CORRECT"
}));

import {
  submitExplainAttempt,
  submitMcqAttempt,
  submitNumericAttempt,
  submitSetupAttempt
} from "@/app/learn/[topicId]/actions";

type MockState = {
  user: { id: string } | null;
  userError: any;
  question: any;
  questionError: any;
  masteryRows: any[];
  masteryError: any;
  attemptInsertError: any;
  insertedAttempts: any[];
  masteryUpdates: Array<{ patch: any; filters: Record<string, any> }>;
};

function makeSupabaseMock(state: MockState) {
  return {
    auth: {
      getUser: vi.fn(async () => ({
        data: { user: state.user },
        error: state.userError
      }))
    },
    from(table: string) {
      if (table === "attempts") {
        return {
          insert: vi.fn(async (payload: any) => {
            state.insertedAttempts.push(payload);
            return { error: state.attemptInsertError };
          })
        };
      }

      if (table === "mastery") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn((_col: string, _value: any) => ({
              in: vi.fn(async (_inCol: string, _ids: string[]) => ({
                data: state.masteryRows,
                error: state.masteryError
              }))
            }))
          })),
          update: vi.fn((patch: any) => {
            const row = { patch, filters: {} as Record<string, any> };
            state.masteryUpdates.push(row);
            return {
              eq: vi.fn((col: string, value: any) => {
                row.filters[col] = value;
                return {
                  eq: vi.fn((col2: string, value2: any) => {
                    row.filters[col2] = value2;
                    return {};
                  })
                };
              })
            };
          })
        };
      }

      if (table === "questions") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn((_col: string, _value: any) => ({
              single: vi.fn(async () => ({
                data: state.question,
                error: state.questionError
              }))
            }))
          }))
        };
      }

      throw new Error(`Unhandled table in mock: ${table}`);
    }
  };
}

function makeState(overrides: Partial<MockState> = {}): MockState {
  return {
    user: { id: "user-1" },
    userError: null,
    question: {
      id: "q1",
      topic_id: "T1",
      type: "MCQ",
      prompt: "Prompt",
      canonical_solution: "Use known equations.",
      correct_choice_index: 1,
      numeric_answer: 25,
      numeric_tolerance: 0.5,
      micro_skill_ids: ["MS1", "MS2"]
    },
    questionError: null,
    masteryRows: [
      { micro_skill_id: "MS1", mastery_score: 0.5 },
      { micro_skill_id: "MS2", mastery_score: 0.8 }
    ],
    masteryError: null,
    attemptInsertError: null,
    insertedAttempts: [],
    masteryUpdates: [],
    ...overrides
  };
}

function makeFormData(entries: Record<string, string>) {
  const form = new FormData();
  for (const [k, v] of Object.entries(entries)) {
    form.set(k, v);
  }
  return form;
}

async function expectRedirect(promise: Promise<unknown>, expectedUrl: string) {
  await expect(promise).rejects.toBeInstanceOf(RedirectError);
  await expect(promise).rejects.toMatchObject({ url: expectedUrl });
}

describe("learn actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    evaluateSetupMock.mockReturnValue({
      state: "CORRECT",
      reason: "setup_aligned",
      feedback: "Nice setup",
      source: "RULES"
    });
    evaluateExplainMock.mockResolvedValue({
      state: "CORRECT",
      reason: "conceptual_match",
      feedback: "Nice explanation",
      source: "AI",
      canonicalSolutionUsed: true,
      grounded_quotes: ["quote"]
    });
  });

  it("submitMcqAttempt inserts and redirects on success", async () => {
    const state = makeState();
    createSupabaseServerClientMock.mockResolvedValue(makeSupabaseMock(state));

    await expectRedirect(
      submitMcqAttempt(makeFormData({ topicId: "T1", questionId: "q1", selectedChoiceIndex: "1" })),
      "/learn/T1?last=q1&correct=1"
    );

    expect(state.insertedAttempts[0]).toMatchObject({ correct: true });
    expect(state.masteryUpdates).toHaveLength(2);
  });

  it("submitNumericAttempt rejects bad numeric input", async () => {
    const state = makeState({ question: { ...makeState().question, type: "NUMERIC" } });
    createSupabaseServerClientMock.mockResolvedValue(makeSupabaseMock(state));

    await expectRedirect(
      submitNumericAttempt(makeFormData({ topicId: "T1", questionId: "q1", numericInput: "abc" })),
      "/learn/T1?err=bad_number"
    );
  });

  it("submitSetupAttempt persists structured setup payload", async () => {
    const state = makeState({ question: { ...makeState().question, type: "SETUP" } });
    createSupabaseServerClientMock.mockResolvedValue(makeSupabaseMock(state));

    await expectRedirect(
      submitSetupAttempt(
        makeFormData({ topicId: "T1", questionId: "q1", type: "SETUP", setupInput: "Given values" })
      ),
      "/learn/T1?last=q1&correct=1"
    );

    expect(state.insertedAttempts[0].response).toMatchObject({
      type: "SETUP",
      setupInput: "Given values",
      evaluation: {
        state: "CORRECT",
        reason: "setup_aligned",
        source: "RULES"
      }
    });
  });

  it("submitExplainAttempt redirects with evaluation_failed when AI unavailable", async () => {
    evaluateExplainMock.mockResolvedValue({
      state: "UNSCORABLE",
      reason: "ai_unavailable",
      feedback: "retry",
      source: "RULES",
      canonicalSolutionUsed: false,
      grounded_quotes: []
    });

    const state = makeState({ question: { ...makeState().question, type: "EXPLAIN" } });
    createSupabaseServerClientMock.mockResolvedValue(makeSupabaseMock(state));

    await expectRedirect(
      submitExplainAttempt(
        makeFormData({
          topicId: "T1",
          questionId: "q1",
          type: "EXPLAIN",
          explainInput: "Because acceleration is constant"
        })
      ),
      "/learn/T1?last=q1&correct=0&err=evaluation_failed"
    );
  });

  it("submitSetupAttempt returns empty_response for blank input", async () => {
    await expectRedirect(
      submitSetupAttempt(makeFormData({ topicId: "T1", questionId: "q1", type: "SETUP", setupInput: " " })),
      "/learn/T1?err=empty_response"
    );
  });

  it("submitExplainAttempt returns unsupported_type for bad type", async () => {
    await expectRedirect(
      submitExplainAttempt(
        makeFormData({ topicId: "T1", questionId: "q1", type: "SETUP", explainInput: "x" })
      ),
      "/learn/T1?err=unsupported_type"
    );
  });

  it("redirects on question_not_found", async () => {
    const state = makeState({ question: null, questionError: new Error("missing") });
    createSupabaseServerClientMock.mockResolvedValue(makeSupabaseMock(state));

    await expectRedirect(
      submitSetupAttempt(
        makeFormData({ topicId: "T1", questionId: "missing", type: "SETUP", setupInput: "Given" })
      ),
      "/learn/T1?err=question_not_found"
    );
  });

  it("redirects on topic mismatch", async () => {
    const state = makeState({ question: { ...makeState().question, topic_id: "OTHER", type: "SETUP" } });
    createSupabaseServerClientMock.mockResolvedValue(makeSupabaseMock(state));

    await expectRedirect(
      submitSetupAttempt(
        makeFormData({ topicId: "T1", questionId: "q1", type: "SETUP", setupInput: "Given" })
      ),
      "/learn/T1?err=topic_mismatch"
    );
  });

  it("redirects on wrong_type", async () => {
    const state = makeState({ question: { ...makeState().question, type: "MCQ" } });
    createSupabaseServerClientMock.mockResolvedValue(makeSupabaseMock(state));

    await expectRedirect(
      submitSetupAttempt(
        makeFormData({ topicId: "T1", questionId: "q1", type: "SETUP", setupInput: "Given" })
      ),
      "/learn/T1?err=wrong_type"
    );
  });

  it("redirects on attempt_insert", async () => {
    const state = makeState({ question: { ...makeState().question, type: "SETUP" }, attemptInsertError: new Error("fail") });
    createSupabaseServerClientMock.mockResolvedValue(makeSupabaseMock(state));

    await expectRedirect(
      submitSetupAttempt(
        makeFormData({ topicId: "T1", questionId: "q1", type: "SETUP", setupInput: "Given" })
      ),
      "/learn/T1?err=attempt_insert"
    );
  });

  it("redirects to bad_request when required fields are missing", async () => {
    await expectRedirect(submitSetupAttempt(makeFormData({ topicId: "T1", type: "SETUP" })), "/learn/T1?err=bad_request");
  });

  it("redirects to login when unauthenticated", async () => {
    const state = makeState({ user: null, question: { ...makeState().question, type: "SETUP" } });
    createSupabaseServerClientMock.mockResolvedValue(makeSupabaseMock(state));

    await expectRedirect(
      submitSetupAttempt(
        makeFormData({ topicId: "T1", questionId: "q1", type: "SETUP", setupInput: "Given" })
      ),
      "/login"
    );
  });
});

