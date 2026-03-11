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
  hasCompletedDiagnosticSessionMock,
  evaluateSetupMock,
  evaluateExplainMock
} = vi.hoisted(() => ({
  redirectMock: vi.fn((url: string) => {
    throw new RedirectError(url);
  }),
  createSupabaseServerClientMock: vi.fn(),
  hasCompletedDiagnosticSessionMock: vi.fn(async () => false),
  evaluateSetupMock: vi.fn(),
  evaluateExplainMock: vi.fn()
}));

vi.mock("next/navigation", () => ({
  redirect: redirectMock
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: createSupabaseServerClientMock
}));

vi.mock("@/lib/learning/diagnostic", async importOriginal => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    hasCompletedDiagnosticSession: hasCompletedDiagnosticSessionMock
  };
});

vi.mock("@/lib/learning/text-evaluation", () => ({
  evaluateSetup: evaluateSetupMock,
  evaluateExplain: evaluateExplainMock,
  isCorrectState: (state: string) => state === "CORRECT"
}));

import { startDiagnosticSession, submitDiagnosticAttempt } from "@/app/diagnostic/actions";

type MockState = {
  user: { id: string } | null;
  userError: any;
  session: any;
  sessionError: any;
  question: any;
  questionError: any;
  masteryRows: any[];
  masteryError: any;
  attemptInsertError: any;
  sessionInsertError: any;
  insertedAttempts: any[];
  insertedSessions: any[];
  masteryUpdates: Array<{ patch: any; filters: Record<string, any> }>;
  sessionUpdates: Array<{ patch: any; filters: Record<string, any> }>;
  initialAttemptCount: number;
};

function makeSupabaseMock(state: MockState) {
  return {
    auth: {
      getUser: vi.fn(async () => ({
        data: { user: state.user },
        error: state.userError
      }))
    },
    rpc: vi.fn(async () => ({ error: null })),
    from(table: string) {
      if (table === "sessions") {
        return {
          insert: vi.fn((payload: any) => {
            state.insertedSessions.push(payload);
            return {
              select: vi.fn(() => ({
                single: vi.fn(async () => ({
                  data: state.sessionInsertError ? null : { id: "sess-1" },
                  error: state.sessionInsertError
                }))
              }))
            };
          }),
          select: vi.fn(() => ({
            eq: vi.fn((_col: string, _value: any) => ({
              single: vi.fn(async () => ({
                data: state.session,
                error: state.sessionError
              }))
            }))
          })),
          update: vi.fn((patch: any) => {
            const row = { patch, filters: {} as Record<string, any> };
            state.sessionUpdates.push(row);
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

      if (table === "attempts") {
        return {
          insert: vi.fn(async (payload: any) => {
            state.insertedAttempts.push(payload);
            return { error: state.attemptInsertError };
          }),
          select: vi.fn(() => ({
            eq: vi.fn((_col1: string, _val1: any) => ({
              eq: vi.fn(async (_col2: string, _val2: any) => ({
                data: Array.from({ length: state.initialAttemptCount + state.insertedAttempts.length }).map(
                  (_, i) => ({ id: `a-${i}` })
                ),
                error: null
              }))
            }))
          }))
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

      throw new Error(`Unhandled table in mock: ${table}`);
    }
  };
}

function makeState(overrides: Partial<MockState> = {}): MockState {
  return {
    user: { id: "user-1" },
    userError: null,
    session: { id: "sess-1", user_id: "user-1", mode: "DIAGNOSTIC", ended_at: null },
    sessionError: null,
    question: {
      id: "q1",
      type: "MCQ",
      difficulty: 2,
      prompt: "Prompt",
      canonical_solution: "Canonical",
      correct_choice_index: 1,
      numeric_answer: 20,
      numeric_tolerance: 0.5,
      micro_skill_ids: ["MS1", "MS2"]
    },
    questionError: null,
    masteryRows: [
      { micro_skill_id: "MS1", mastery_score: 0.3 },
      { micro_skill_id: "MS2", mastery_score: 0.4 }
    ],
    masteryError: null,
    attemptInsertError: null,
    sessionInsertError: null,
    insertedAttempts: [],
    insertedSessions: [],
    masteryUpdates: [],
    sessionUpdates: [],
    initialAttemptCount: 0,
    ...overrides
  };
}

function makeFormData(entries: Record<string, string>) {
  const form = new FormData();
  for (const [key, value] of Object.entries(entries)) {
    form.set(key, value);
  }
  return form;
}

async function expectRedirect(promise: Promise<unknown>, expectedUrl: string) {
  await expect(promise).rejects.toBeInstanceOf(RedirectError);
  await expect(promise).rejects.toMatchObject({ url: expectedUrl });
}

describe("diagnostic actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hasCompletedDiagnosticSessionMock.mockResolvedValue(false);
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

  it("startDiagnosticSession creates session and redirects", async () => {
    const state = makeState();
    createSupabaseServerClientMock.mockResolvedValue(makeSupabaseMock(state));

    await expectRedirect(startDiagnosticSession(), "/diagnostic?session=sess-1");
    expect(state.insertedSessions[0]).toMatchObject({ user_id: "user-1", mode: "DIAGNOSTIC" });
  });

  it("submitDiagnosticAttempt handles SETUP payload", async () => {
    const state = makeState({ question: { ...makeState().question, type: "SETUP" } });
    createSupabaseServerClientMock.mockResolvedValue(makeSupabaseMock(state));

    await expectRedirect(
      submitDiagnosticAttempt(
        makeFormData({ sessionId: "sess-1", questionId: "q1", type: "SETUP", setupInput: "Given values" })
      ),
      "/diagnostic?session=sess-1&last=q1&correct=1"
    );

    expect(state.insertedAttempts[0].response).toMatchObject({
      type: "SETUP",
      setupInput: "Given values",
      evaluation: { state: "CORRECT", reason: "setup_aligned", source: "RULES" }
    });
  });

  it("submitDiagnosticAttempt handles EXPLAIN evaluation failure", async () => {
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
      submitDiagnosticAttempt(
        makeFormData({
          sessionId: "sess-1",
          questionId: "q1",
          type: "EXPLAIN",
          explainInput: "Because acceleration changes velocity"
        })
      ),
      "/diagnostic?session=sess-1&last=q1&correct=0&err=evaluation_failed"
    );
  });

  it("finalizes session on 15th attempt", async () => {
    const state = makeState({ initialAttemptCount: 14 });
    createSupabaseServerClientMock.mockResolvedValue(makeSupabaseMock(state));

    await expectRedirect(
      submitDiagnosticAttempt(
        makeFormData({ sessionId: "sess-1", questionId: "q1", type: "MCQ", selectedChoiceIndex: "1" })
      ),
      "/diagnostic?session=sess-1&complete=1"
    );

    expect(state.sessionUpdates).toHaveLength(1);
  });

  it("redirects on bad_request", async () => {
    await expectRedirect(submitDiagnosticAttempt(makeFormData({ sessionId: "sess-1" })), "/diagnostic?err=bad_request");
  });

  it("redirects on bad_session", async () => {
    const state = makeState({ session: null, sessionError: new Error("missing") });
    createSupabaseServerClientMock.mockResolvedValue(makeSupabaseMock(state));

    await expectRedirect(
      submitDiagnosticAttempt(
        makeFormData({ sessionId: "sess-1", questionId: "q1", type: "MCQ", selectedChoiceIndex: "1" })
      ),
      "/diagnostic?err=bad_session"
    );
  });

  it("redirects on question_not_found", async () => {
    const state = makeState({ question: null, questionError: new Error("missing") });
    createSupabaseServerClientMock.mockResolvedValue(makeSupabaseMock(state));

    await expectRedirect(
      submitDiagnosticAttempt(
        makeFormData({ sessionId: "sess-1", questionId: "q1", type: "MCQ", selectedChoiceIndex: "1" })
      ),
      "/diagnostic?session=sess-1&err=question_not_found"
    );
  });

  it("redirects on wrong_type", async () => {
    const state = makeState({ question: { ...makeState().question, type: "MCQ" } });
    createSupabaseServerClientMock.mockResolvedValue(makeSupabaseMock(state));

    await expectRedirect(
      submitDiagnosticAttempt(
        makeFormData({ sessionId: "sess-1", questionId: "q1", type: "NUMERIC", numericInput: "20" })
      ),
      "/diagnostic?session=sess-1&err=wrong_type"
    );
  });

  it("redirects on unsupported_type", async () => {
    const state = makeState();
    createSupabaseServerClientMock.mockResolvedValue(makeSupabaseMock(state));

    await expectRedirect(
      submitDiagnosticAttempt(makeFormData({ sessionId: "sess-1", questionId: "q1", type: "BOGUS" })),
      "/diagnostic?session=sess-1&err=unsupported_type"
    );
  });

  it("redirects on empty_response", async () => {
    const state = makeState({ question: { ...makeState().question, type: "SETUP" } });
    createSupabaseServerClientMock.mockResolvedValue(makeSupabaseMock(state));

    await expectRedirect(
      submitDiagnosticAttempt(
        makeFormData({ sessionId: "sess-1", questionId: "q1", type: "SETUP", setupInput: " " })
      ),
      "/diagnostic?session=sess-1&err=empty_response"
    );
  });

  it("redirects on attempt_insert", async () => {
    const state = makeState({ attemptInsertError: new Error("insert") });
    createSupabaseServerClientMock.mockResolvedValue(makeSupabaseMock(state));

    await expectRedirect(
      submitDiagnosticAttempt(
        makeFormData({ sessionId: "sess-1", questionId: "q1", type: "MCQ", selectedChoiceIndex: "1" })
      ),
      "/diagnostic?session=sess-1&err=attempt_insert"
    );
  });

  it("redirects to login when unauthenticated", async () => {
    const state = makeState({ user: null });
    createSupabaseServerClientMock.mockResolvedValue(makeSupabaseMock(state));

    await expectRedirect(
      submitDiagnosticAttempt(
        makeFormData({ sessionId: "sess-1", questionId: "q1", type: "MCQ", selectedChoiceIndex: "1" })
      ),
      "/login"
    );
  });
});

