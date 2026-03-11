import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { hasCompletedDiagnosticSession } from "@/lib/learning/diagnostic";
import {
  submitExplainAttempt,
  submitMcqAttempt,
  submitNumericAttempt,
  submitSetupAttempt
} from "./actions";

type TopicRow = {
  id: string;
  name: string;
  order: number;
  prerequisite_topic_ids: any;
};

type QuestionRow = {
  id: string;
  topic_id: string;
  type: "MCQ" | "NUMERIC" | "SETUP" | "EXPLAIN";
  difficulty: 1 | 2 | 3;
  prompt: string;
  choices: any;
  correct_choice_index: number | null;
  correct_answer_text: string;
  canonical_solution: string;
  micro_skill_ids: any;
};

type MasteryRow = {
  micro_skill_id: string;
  mastery_score: number;
};

function asStringArray(v: any): string[] {
  if (!v) return [];
  if (Array.isArray(v)) return v.filter(x => typeof x === "string");
  return [];
}

function learnErrorMessage(errCode: string) {
  const map: Record<string, string> = {
    bad_request: "The submission was missing required fields. Please try again.",
    question_not_found: "We could not find that question. Please refresh and try again.",
    topic_mismatch: "That answer does not match this topic. Please try again.",
    wrong_type: "That submission type does not match the current question.",
    unsupported_type: "This question type is not supported for this action.",
    empty_response: "Please enter an answer before submitting.",
    bad_number: "Please enter a valid numeric value.",
    attempt_insert: "We could not save your attempt right now. Please retry.",
    evaluation_failed: "We saved your attempt, but feedback evaluation was unavailable this time."
  };

  return map[errCode] ?? "Something went wrong while submitting your answer.";
}

export default async function LearnTopicPage({
  params,
  searchParams
}: {
  params: Promise<{ topicId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { topicId } = await params;
  const sp = await searchParams;

  const supabase = await createSupabaseServerClient();

  const { data: userData } = await supabase.auth.getUser();
  if (!userData?.user) redirect("/login");

  await supabase.rpc("init_user_progress");

  const hasCompletedDiagnostic = await hasCompletedDiagnosticSession(supabase, userData.user.id);
  if (!hasCompletedDiagnostic) {
    redirect("/diagnostic");
  }

  const { data: topic, error: topicErr } = await supabase
    .from("topics")
    .select("id,name,order,prerequisite_topic_ids")
    .eq("id", topicId)
    .single();

  if (topicErr || !topic) redirect("/dashboard");

  const { data: topics } = await supabase.from("topics").select("id,order,prerequisite_topic_ids").order("order");

  const { data: mastery } = await supabase.from("mastery").select("micro_skill_id,mastery_score");

  const { data: questionsAll } = await supabase.from("questions").select("id,topic_id,micro_skill_ids");

  const masteryMap = new Map<string, number>();
  for (const m of (mastery ?? []) as MasteryRow[]) {
    masteryMap.set(m.micro_skill_id, m.mastery_score ?? 0);
  }

  const topicSkillSets = new Map<string, Set<string>>();
  for (const q of (questionsAll ?? []) as any[]) {
    const skills = asStringArray(q.micro_skill_ids);
    if (!topicSkillSets.has(q.topic_id)) topicSkillSets.set(q.topic_id, new Set());
    const set = topicSkillSets.get(q.topic_id)!;
    for (const s of skills) set.add(s);
  }

  const topicProgress = new Map<string, number>();
  for (const t of (topics ?? []) as any[]) {
    const set = topicSkillSets.get(t.id) ?? new Set<string>();
    const skills = Array.from(set);
    if (skills.length === 0) {
      topicProgress.set(t.id, 0);
      continue;
    }
    let sum = 0;
    for (const s of skills) sum += masteryMap.get(s) ?? 0;
    topicProgress.set(t.id, sum / skills.length);
  }

  const COMPLETE_AT = 0.75;
  const isComplete = (id: string) => (topicProgress.get(id) ?? 0) >= COMPLETE_AT;

  const prereqs = asStringArray((topic as TopicRow).prerequisite_topic_ids);
  const unlocked = prereqs.length === 0 ? true : prereqs.every(pid => isComplete(pid));

  if (!unlocked) {
    redirect("/dashboard");
  }

  const { data: questions, error: questionsErr } = await supabase
    .from("questions")
    .select(
      "id,topic_id,type,difficulty,prompt,choices,correct_choice_index,correct_answer_text,canonical_solution,micro_skill_ids"
    )
    .eq("topic_id", topicId)
    .order("difficulty", { ascending: true });

  if (questionsErr || !questions || questions.length === 0) {
    return (
      <main style={{ padding: 24 }}>
        <h1>Learn</h1>
        <p>Topic: {(topic as TopicRow).name}</p>
        <p>No questions found for this topic yet.</p>
        <a href="/dashboard">Back to dashboard</a>
      </main>
    );
  }

  const questionIds = questions.map(q => q.id);
  const { data: attempts } = await supabase
    .from("attempts")
    .select("question_id, correct, created_at")
    .in("question_id", questionIds);

  const attemptCount = new Map<string, number>();
  for (const q of questions) {
    attemptCount.set(q.id, 0);
  }

  for (const a of attempts ?? []) {
    const qid = a.question_id as string;
    attemptCount.set(qid, (attemptCount.get(qid) ?? 0) + 1);
  }

  function getQuestionWeaknessScore(q: QuestionRow) {
    const skills = asStringArray(q.micro_skill_ids);
    if (skills.length === 0) return 0.5;
    let min = 1;
    for (const s of skills) {
      const v = masteryMap.get(s) ?? 0.3;
      if (v < min) min = v;
    }
    return min;
  }

  const questionWeakness = new Map<string, number>();
  for (const q of questions as any[]) {
    questionWeakness.set(q.id, getQuestionWeaknessScore(q as any));
  }

  const next = [...questions].sort((a, b) => {
    const ca = attemptCount.get(a.id) ?? 0;
    const cb = attemptCount.get(b.id) ?? 0;
    if (ca !== cb) return ca - cb;

    const wa = questionWeakness.get(a.id) ?? 0.5;
    const wb = questionWeakness.get(b.id) ?? 0.5;
    if (wa !== wb) return wa - wb;

    return (a.difficulty ?? 1) - (b.difficulty ?? 1);
  })[0] as QuestionRow;

  const lastCorrect = String(sp.correct ?? "");
  const errCode = String(sp.err ?? "");
  const showFeedback = lastCorrect === "1" || lastCorrect === "0";

  return (
    <main style={{ padding: 24, maxWidth: 820, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
        <div>
          <h1 style={{ margin: 0 }}>Learn</h1>
          <div style={{ color: "#666", marginTop: 6 }}>
            Topic {(topic as TopicRow).order}: {(topic as TopicRow).name}
          </div>
        </div>
        <a href="/dashboard">Back to dashboard</a>
      </div>

      {errCode && (
        <div
          style={{
            marginTop: 16,
            padding: 12,
            borderRadius: 10,
            background: "#fff3f3",
            border: "1px solid #ddd"
          }}
        >
          {learnErrorMessage(errCode)}
        </div>
      )}

      {showFeedback && (
        <div
          style={{
            marginTop: 16,
            padding: 12,
            borderRadius: 10,
            background: lastCorrect === "1" ? "#eef9f2" : "#fff3f3",
            border: "1px solid #ddd"
          }}
        >
          {lastCorrect === "1" ? "Correct. Nice." : "Not quite. Try the next one, or retry later."}
        </div>
      )}

      <section style={{ marginTop: 16, border: "1px solid #ddd", borderRadius: 12, padding: 16 }}>
        <div style={{ color: "#666", fontSize: 12 }}>Question</div>
        <div style={{ fontSize: 18, fontWeight: 700, marginTop: 6 }}>{next.prompt}</div>

        {next.type === "MCQ" && (
          <form action={submitMcqAttempt} style={{ marginTop: 14, display: "grid", gap: 10 }}>
            <input type="hidden" name="topicId" value={topicId} />
            <input type="hidden" name="questionId" value={next.id} />
            <input type="hidden" name="type" value="MCQ" />

            <fieldset style={{ border: "none", padding: 0, margin: 0, display: "grid", gap: 8 }}>
              {(Array.isArray(next.choices) ? next.choices : []).map((c: string, idx: number) => (
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
                  <span>{c}</span>
                </label>
              ))}
            </fieldset>

            <button type="submit" style={{ padding: 10, borderRadius: 10, border: "1px solid #ddd" }}>
              Submit answer
            </button>
          </form>
        )}

        {next.type === "NUMERIC" && (
          <form action={submitNumericAttempt} style={{ marginTop: 14, display: "grid", gap: 10 }}>
            <input type="hidden" name="topicId" value={topicId} />
            <input type="hidden" name="questionId" value={next.id} />
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

        {next.type === "SETUP" && (
          <form action={submitSetupAttempt} style={{ marginTop: 14, display: "grid", gap: 10 }}>
            <input type="hidden" name="topicId" value={topicId} />
            <input type="hidden" name="questionId" value={next.id} />
            <input type="hidden" name="type" value="SETUP" />

            <label style={{ display: "grid", gap: 6 }}>
              Write your setup
              <textarea
                name="setupInput"
                rows={6}
                placeholder="List known values, unknowns, and equations you plan to use."
                style={{ padding: 10, borderRadius: 10, border: "1px solid #ddd", resize: "vertical" }}
              />
            </label>

            <button type="submit" style={{ padding: 10, borderRadius: 10, border: "1px solid #ddd" }}>
              Submit setup
            </button>
          </form>
        )}

        {next.type === "EXPLAIN" && (
          <form action={submitExplainAttempt} style={{ marginTop: 14, display: "grid", gap: 10 }}>
            <input type="hidden" name="topicId" value={topicId} />
            <input type="hidden" name="questionId" value={next.id} />
            <input type="hidden" name="type" value="EXPLAIN" />

            <label style={{ display: "grid", gap: 6 }}>
              Explain your reasoning
              <textarea
                name="explainInput"
                rows={6}
                placeholder="Explain why your approach works using concepts from the lesson."
                style={{ padding: 10, borderRadius: 10, border: "1px solid #ddd", resize: "vertical" }}
              />
            </label>

            <button type="submit" style={{ padding: 10, borderRadius: 10, border: "1px solid #ddd" }}>
              Submit explanation
            </button>
          </form>
        )}

        <details style={{ marginTop: 14 }}>
          <summary style={{ cursor: "pointer" }}>Show solution (for debugging)</summary>
          <div style={{ marginTop: 10, whiteSpace: "pre-wrap" }}>
            <div style={{ fontWeight: 700 }}>Correct answer:</div>
            <div>{next.correct_answer_text}</div>
            <div style={{ fontWeight: 700, marginTop: 10 }}>Canonical solution:</div>
            <div>{next.canonical_solution}</div>
          </div>
        </details>
      </section>

      <p style={{ marginTop: 14, color: "#666", fontSize: 12 }}>
        Mastery updates after each submission using a simple rule: correct moves skill scores up, incorrect moves them down.
      </p>
    </main>
  );
}

