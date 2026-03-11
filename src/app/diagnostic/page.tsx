import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  DIAGNOSTIC_QUESTION_LIMIT,
  hasCompletedDiagnosticSession,
  selectDiagnosticQuestions
} from "@/lib/learning/diagnostic";
import { startDiagnosticSession, submitDiagnosticAttempt } from "./actions";

type QuestionRow = {
  id: string;
  type: "MCQ" | "NUMERIC" | "SETUP" | "EXPLAIN";
  difficulty: 1 | 2 | 3;
  prompt: string;
  choices: unknown;
  micro_skill_ids: unknown;
};

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function asChoices(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

export default async function DiagnosticPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const sessionId = String(sp.session ?? "");
  const completeFlag = String(sp.complete ?? "");
  const correct = String(sp.correct ?? "");

  const supabase = await createSupabaseServerClient();

  const { data: userData } = await supabase.auth.getUser();
  if (!userData?.user) redirect("/login");

  await supabase.rpc("init_user_progress");

  const isDone = await hasCompletedDiagnosticSession(supabase, userData.user.id);
  if (isDone && !sessionId) {
    redirect("/dashboard?diag=complete");
  }

  if (!sessionId) {
    return (
      <main style={{ padding: 24, maxWidth: 780, margin: "0 auto" }}>
        <h1 style={{ marginBottom: 8 }}>Diagnostic</h1>
        <p style={{ color: "#444" }}>
          Start a 15-question mixed diagnostic (MCQ + numeric) to calibrate your mastery map.
        </p>
        <form action={startDiagnosticSession}>
          <button
            type="submit"
            style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #ddd" }}
          >
            Start diagnostic
          </button>
        </form>
      </main>
    );
  }

  const { data: session, error: sessionErr } = await supabase
    .from("sessions")
    .select("id, user_id, ended_at, mode")
    .eq("id", sessionId)
    .single();

  if (sessionErr || !session || session.user_id !== userData.user.id || session.mode !== "DIAGNOSTIC") {
    redirect("/diagnostic?err=bad_session");
  }

  const { data: allQuestions, error: questionsErr } = await supabase
    .from("questions")
    .select("id,type,difficulty,prompt,choices,micro_skill_ids")
    .in("type", ["MCQ", "NUMERIC"])
    .order("id");

  if (questionsErr || !allQuestions || allQuestions.length === 0) {
    return (
      <main style={{ padding: 24, maxWidth: 780, margin: "0 auto" }}>
        <h1>Diagnostic</h1>
        <p>Diagnostic questions are not available right now.</p>
        <a href="/dashboard">Back to dashboard</a>
      </main>
    );
  }

  const selectedQuestions = selectDiagnosticQuestions(allQuestions as QuestionRow[]) as QuestionRow[];
  const targetCount = Math.min(DIAGNOSTIC_QUESTION_LIMIT, selectedQuestions.length);

  const { data: attempts } = await supabase
    .from("attempts")
    .select("id, question_id, correct")
    .eq("user_id", userData.user.id)
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });

  const attemptCount = attempts?.length ?? 0;
  const isComplete = completeFlag === "1" || !!session.ended_at || attemptCount >= targetCount;

  if (isComplete) {
    return (
      <main style={{ padding: 24, maxWidth: 780, margin: "0 auto" }}>
        <h1 style={{ marginBottom: 8 }}>Diagnostic complete</h1>
        <p style={{ color: "#444" }}>
          Great work. Your initial mastery profile is now ready, and learning topics are unlocked.
        </p>
        <a
          href="/dashboard?diag=complete"
          style={{ display: "inline-block", marginTop: 12, padding: "10px 12px", border: "1px solid #ddd", borderRadius: 10, textDecoration: "none", color: "#111" }}
        >
          Continue to dashboard
        </a>
      </main>
    );
  }

  const nextQuestion = selectedQuestions[attemptCount];
  if (!nextQuestion) {
    return (
      <main style={{ padding: 24, maxWidth: 780, margin: "0 auto" }}>
        <h1>Diagnostic</h1>
        <p>No remaining diagnostic questions were found for this session.</p>
        <a href="/dashboard">Back to dashboard</a>
      </main>
    );
  }

  const showFeedback = correct === "1" || correct === "0";
  const microSkills = asStringArray(nextQuestion.micro_skill_ids);

  return (
    <main style={{ padding: 24, maxWidth: 780, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
        <div>
          <h1 style={{ margin: 0 }}>Diagnostic</h1>
          <div style={{ color: "#666", marginTop: 6 }}>
            Question {Math.min(attemptCount + 1, targetCount)} of {targetCount}
          </div>
        </div>
        <a href="/dashboard">Back to dashboard</a>
      </div>

      {showFeedback && (
        <div
          style={{
            marginTop: 16,
            padding: 12,
            borderRadius: 10,
            background: correct === "1" ? "#eef9f2" : "#fff3f3",
            border: "1px solid #ddd"
          }}
        >
          {correct === "1" ? "Correct." : "Not quite."}
        </div>
      )}

      <section style={{ marginTop: 16, border: "1px solid #ddd", borderRadius: 12, padding: 16 }}>
        <div style={{ color: "#666", fontSize: 12 }}>
          Type: {nextQuestion.type} | Difficulty: {nextQuestion.difficulty}
        </div>
        <div style={{ fontSize: 18, fontWeight: 700, marginTop: 8 }}>{nextQuestion.prompt}</div>
        {microSkills.length > 0 && (
          <div style={{ color: "#666", fontSize: 12, marginTop: 8 }}>
            Skills: {microSkills.join(", ")}
          </div>
        )}

        {nextQuestion.type === "MCQ" && (
          <form action={submitDiagnosticAttempt} style={{ marginTop: 14, display: "grid", gap: 10 }}>
            <input type="hidden" name="sessionId" value={sessionId} />
            <input type="hidden" name="questionId" value={nextQuestion.id} />
            <input type="hidden" name="type" value="MCQ" />

            <fieldset style={{ border: "none", padding: 0, margin: 0, display: "grid", gap: 8 }}>
              {asChoices(nextQuestion.choices).map((choice, idx) => (
                <label
                  key={idx}
                  style={{
                    display: "flex",
                    gap: 10,
                    alignItems: "flex-start",
                    border: "1px solid #ddd",
                    borderRadius: 10,
                    padding: 12,
                    cursor: "pointer"
                  }}
                >
                  <input type="radio" name="selectedChoiceIndex" value={String(idx)} />
                  <span>{choice}</span>
                </label>
              ))}
            </fieldset>

            <button type="submit" style={{ padding: 10, borderRadius: 10, border: "1px solid #ddd" }}>
              Submit answer
            </button>
          </form>
        )}

        {nextQuestion.type === "NUMERIC" && (
          <form action={submitDiagnosticAttempt} style={{ marginTop: 14, display: "grid", gap: 10 }}>
            <input type="hidden" name="sessionId" value={sessionId} />
            <input type="hidden" name="questionId" value={nextQuestion.id} />
            <input type="hidden" name="type" value="NUMERIC" />

            <label style={{ display: "grid", gap: 6 }}>
              Your answer (number)
              <input
                name="numericInput"
                inputMode="decimal"
                placeholder="Example: 25"
                style={{ padding: 10, borderRadius: 10, border: "1px solid #ddd" }}
              />
            </label>

            <button type="submit" style={{ padding: 10, borderRadius: 10, border: "1px solid #ddd" }}>
              Submit answer
            </button>
          </form>
        )}
      </section>
    </main>
  );
}
