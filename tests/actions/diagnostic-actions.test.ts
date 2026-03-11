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
  hasCompletedDiagnosticSessionMock
} = vi.hoisted(() => ({
  redirectMock: vi.fn((url: string) => {
    throw new RedirectError(url);
  }),
  createSupabaseServerClientMock: vi.fn(),
  hasCompletedDiagnosticSessionMock: vi.fn(async () => false)
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

import {
  startDiagnosticSession,
  submitDiagnosticAttempt
} from "@/app/diagnostic/actions";

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
                data: Array.from({
                  length: state.initialAttemptCount + state.insertedAttempts.length
                }).map((_, i) => ({ id: `a-${i}` })),
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
    session: {
      id: "sess-1",
      user_id: "user-1",
      mode: "DIAGNOSTIC",
      ended_at: null
    },
    sessionError: null,
    question: {
      id: "q1",
      type: "MCQ",
      difficulty: 2,
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
  });

  describe("startDiagnosticSession", () => {
    it("redirects to login when unauthenticated", async () => {
      const state = makeState({ user: null });
      createSupabaseServerClientMock.mockResolvedValue(makeSupabaseMock(state));

      await expectRedirect(startDiagnosticSession(), "/login");
    });

    it("creates diagnostic session and redirects", async () => {
      const state = makeState();
      createSupabaseServerClientMock.mockResolvedValue(makeSupabaseMock(state));

      await expectRedirect(startDiagnosticSession(), "/diagnostic?session=sess-1");
      expect(state.insertedSessions).toHaveLength(1);
      expect(state.insertedSessions[0]).toMatchObject({
        user_id: "user-1",
        mode: "DIAGNOSTIC"
      });
    });
  });

  describe("submitDiagnosticAttempt", () => {
    it("redirects to login when unauthenticated", async () => {
      const state = makeState({ user: null });
      createSupabaseServerClientMock.mockResolvedValue(makeSupabaseMock(state));

      const form = makeFormData({
        sessionId: "sess-1",
        questionId: "q1",
        type: "MCQ",
        selectedChoiceIndex: "1"
      });

      await expectRedirect(submitDiagnosticAttempt(form), "/login");
    });

    it("inserts attempt with session id and updates mastery", async () => {
      const state = makeState();
      createSupabaseServerClientMock.mockResolvedValue(makeSupabaseMock(state));

      const form = makeFormData({
        sessionId: "sess-1",
        questionId: "q1",
        type: "MCQ",
        selectedChoiceIndex: "1"
      });

      await expectRedirect(
        submitDiagnosticAttempt(form),
        "/diagnostic?session=sess-1&last=q1&correct=1"
      );

      expect(state.insertedAttempts).toHaveLength(1);
      expect(state.insertedAttempts[0]).toMatchObject({
        user_id: "user-1",
        session_id: "sess-1",
        question_id: "q1",
        correct: true
      });
      expect(state.masteryUpdates).toHaveLength(2);
    });

    it("finalizes session at attempt 15", async () => {
      const state = makeState({ initialAttemptCount: 14 });
      createSupabaseServerClientMock.mockResolvedValue(makeSupabaseMock(state));

      const form = makeFormData({
        sessionId: "sess-1",
        questionId: "q1",
        type: "MCQ",
        selectedChoiceIndex: "1"
      });

      await expectRedirect(
        submitDiagnosticAttempt(form),
        "/diagnostic?session=sess-1&complete=1"
      );

      expect(state.sessionUpdates).toHaveLength(1);
      expect(state.sessionUpdates[0].filters).toMatchObject({
        id: "sess-1",
        user_id: "user-1"
      });
      expect(typeof state.sessionUpdates[0].patch.ended_at).toBe("string");
    });
  });
});
