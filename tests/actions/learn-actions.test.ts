import { beforeEach, describe, expect, it, vi } from "vitest";

class RedirectError extends Error {
  url: string;

  constructor(url: string) {
    super(`Redirect: ${url}`);
    this.url = url;
  }
}

const { redirectMock, createSupabaseServerClientMock } = vi.hoisted(() => ({
  redirectMock: vi.fn((url: string) => {
    throw new RedirectError(url);
  }),
  createSupabaseServerClientMock: vi.fn()
}));

vi.mock("next/navigation", () => ({
  redirect: redirectMock
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: createSupabaseServerClientMock
}));

import {
  submitMcqAttempt,
  submitNumericAttempt
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
          select: vi.fn(() => {
            return {
              eq: vi.fn((_col: string, _value: any) => ({
                in: vi.fn(async (_inCol: string, _ids: string[]) => ({
                  data: state.masteryRows,
                  error: state.masteryError
                }))
              })),
              in: vi.fn(async (_inCol: string, _ids: string[]) => ({
                data: state.masteryRows,
                error: state.masteryError
              }))
            };
          }),
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
  });

  describe("submitMcqAttempt", () => {
    it("inserts attempt, updates mastery, and redirects on success", async () => {
      const state = makeState();
      createSupabaseServerClientMock.mockResolvedValue(makeSupabaseMock(state));

      const form = makeFormData({
        topicId: "T1",
        questionId: "q1",
        selectedChoiceIndex: "1"
      });

      await expectRedirect(
        submitMcqAttempt(form),
        "/learn/T1?last=q1&correct=1"
      );

      expect(state.insertedAttempts).toHaveLength(1);
      expect(state.insertedAttempts[0]).toMatchObject({
        user_id: "user-1",
        question_id: "q1",
        correct: true
      });
      expect(state.masteryUpdates).toHaveLength(2);
    });

    it("redirects safely on topic mismatch", async () => {
      const state = makeState({
        question: {
          id: "q1",
          topic_id: "OTHER",
          type: "MCQ",
          correct_choice_index: 1,
          micro_skill_ids: ["MS1"]
        }
      });
      createSupabaseServerClientMock.mockResolvedValue(makeSupabaseMock(state));

      const form = makeFormData({
        topicId: "T1",
        questionId: "q1",
        selectedChoiceIndex: "1"
      });

      await expectRedirect(submitMcqAttempt(form), "/learn/T1?err=topic_mismatch");
    });

    it("redirects to login when unauthenticated", async () => {
      const state = makeState({ user: null });
      createSupabaseServerClientMock.mockResolvedValue(makeSupabaseMock(state));

      const form = makeFormData({
        topicId: "T1",
        questionId: "q1",
        selectedChoiceIndex: "1"
      });

      await expectRedirect(submitMcqAttempt(form), "/login");
    });
  });

  describe("submitNumericAttempt", () => {
    it("redirects with error query on invalid numeric input", async () => {
      const state = makeState({
        question: {
          id: "q1",
          topic_id: "T1",
          type: "NUMERIC",
          numeric_answer: 25,
          numeric_tolerance: 0.5,
          micro_skill_ids: ["MS1"]
        }
      });
      createSupabaseServerClientMock.mockResolvedValue(makeSupabaseMock(state));

      const form = makeFormData({
        topicId: "T1",
        questionId: "q1",
        numericInput: "abc"
      });

      await expectRedirect(submitNumericAttempt(form), "/learn/T1?err=bad_number");
    });

    it("inserts attempt, updates mastery, and redirects on success", async () => {
      const state = makeState({
        question: {
          id: "q1",
          topic_id: "T1",
          type: "NUMERIC",
          numeric_answer: 25,
          numeric_tolerance: 0.5,
          micro_skill_ids: ["MS1", "MS2"]
        }
      });
      createSupabaseServerClientMock.mockResolvedValue(makeSupabaseMock(state));

      const form = makeFormData({
        topicId: "T1",
        questionId: "q1",
        numericInput: "25.5"
      });

      await expectRedirect(
        submitNumericAttempt(form),
        "/learn/T1?last=q1&correct=1"
      );

      expect(state.insertedAttempts).toHaveLength(1);
      expect(state.insertedAttempts[0]).toMatchObject({
        user_id: "user-1",
        question_id: "q1",
        correct: true
      });
      expect(state.masteryUpdates).toHaveLength(2);
    });

    it("redirects safely on wrong question type", async () => {
      const state = makeState({
        question: {
          id: "q1",
          topic_id: "T1",
          type: "MCQ",
          correct_choice_index: 1,
          micro_skill_ids: ["MS1"]
        }
      });
      createSupabaseServerClientMock.mockResolvedValue(makeSupabaseMock(state));

      const form = makeFormData({
        topicId: "T1",
        questionId: "q1",
        numericInput: "20"
      });

      await expectRedirect(submitNumericAttempt(form), "/learn/T1?err=wrong_type");
    });

    it("redirects to login when unauthenticated", async () => {
      const state = makeState({ user: null });
      createSupabaseServerClientMock.mockResolvedValue(makeSupabaseMock(state));

      const form = makeFormData({
        topicId: "T1",
        questionId: "q1",
        numericInput: "25"
      });

      await expectRedirect(submitNumericAttempt(form), "/login");
    });
  });
});
