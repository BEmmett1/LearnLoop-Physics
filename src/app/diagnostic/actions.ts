"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { gradeMcqAnswer, gradeNumericAnswer } from "@/lib/learning/grading";
import {
  DIAGNOSTIC_QUESTION_LIMIT,
  hasCompletedDiagnosticSession,
  updateMasteryScoreWithDifficulty
} from "@/lib/learning/diagnostic";
import { evaluateExplain, evaluateSetup, isCorrectState } from "@/lib/learning/text-evaluation";

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

type DiagnosticQuestionRow = {
  id: string;
  type: "MCQ" | "NUMERIC" | "SETUP" | "EXPLAIN";
  difficulty: number | null;
  prompt: string | null;
  canonical_solution: string | null;
  correct_choice_index: number | null;
  numeric_answer: number | null;
  numeric_tolerance: number | null;
  micro_skill_ids: unknown;
};

function diagnosticErr(sessionId: string, err: string) {
  return `/diagnostic?session=${encodeURIComponent(sessionId)}&err=${encodeURIComponent(err)}`;
}

function buildDiagnosticProgressRedirect(
  sessionId: string,
  questionId: string,
  correct: boolean,
  errCode?: string
) {
  const params = new URLSearchParams({
    session: sessionId,
    last: questionId,
    correct: correct ? "1" : "0"
  });

  if (errCode) {
    params.set("err", errCode);
  }

  return `/diagnostic?${params.toString()}`;
}

export async function startDiagnosticSession() {
  const supabase = await createSupabaseServerClient();

  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userData?.user) redirect("/login");

  await supabase.rpc("init_user_progress");

  const isDone = await hasCompletedDiagnosticSession(supabase, userData.user.id);
  if (isDone) {
    redirect("/dashboard?diag=complete");
  }

  const { data: session, error: sessionErr } = await supabase
    .from("sessions")
    .insert({
      user_id: userData.user.id,
      mode: "DIAGNOSTIC"
    })
    .select("id")
    .single();

  if (sessionErr || !session?.id) {
    redirect(`/diagnostic?err=session_create`);
  }

  redirect(`/diagnostic?session=${encodeURIComponent(session.id)}`);
}

export async function submitDiagnosticAttempt(formData: FormData) {
  const sessionId = String(formData.get("sessionId") ?? "");
  const questionId = String(formData.get("questionId") ?? "");
  const type = String(formData.get("type") ?? "");

  if (!sessionId || !questionId || !type) {
    redirect("/diagnostic?err=bad_request");
  }

  const supabase = await createSupabaseServerClient();

  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userData?.user) redirect("/login");

  const { data: session, error: sessionErr } = await supabase
    .from("sessions")
    .select("id, user_id, mode, ended_at")
    .eq("id", sessionId)
    .single();

  if (
    sessionErr ||
    !session ||
    session.user_id !== userData.user.id ||
    session.mode !== "DIAGNOSTIC" ||
    session.ended_at
  ) {
    redirect("/diagnostic?err=bad_session");
  }

  const { data: question, error: questionErr } = await supabase
    .from("questions")
    .select(
      "id, type, difficulty, prompt, canonical_solution, correct_choice_index, numeric_answer, numeric_tolerance, micro_skill_ids"
    )
    .eq("id", questionId)
    .single();

  if (questionErr || !question) {
    redirect(diagnosticErr(sessionId, "question_not_found"));
  }

  const q = question as DiagnosticQuestionRow;

  let correct = false;
  let response: Record<string, unknown> = {};
  let evaluationFailed = false;

  if (type === "MCQ") {
    if (q.type !== "MCQ") {
      redirect(diagnosticErr(sessionId, "wrong_type"));
    }

    const selectedStr = String(formData.get("selectedChoiceIndex") ?? "");
    const selectedChoiceIndex = selectedStr === "" ? null : Number(selectedStr);
    correct = gradeMcqAnswer(selectedChoiceIndex, q.correct_choice_index);
    response = { selectedChoiceIndex };
  } else if (type === "NUMERIC") {
    if (q.type !== "NUMERIC") {
      redirect(diagnosticErr(sessionId, "wrong_type"));
    }

    const inputStr = String(formData.get("numericInput") ?? "").trim();
    const input = inputStr === "" ? null : Number(inputStr);
    if (inputStr !== "" && Number.isNaN(input)) {
      redirect(diagnosticErr(sessionId, "bad_number"));
    }

    correct = gradeNumericAnswer(input, q.numeric_answer, q.numeric_tolerance);
    response = { numericInput: inputStr };
  } else if (type === "SETUP") {
    if (q.type !== "SETUP") {
      redirect(diagnosticErr(sessionId, "wrong_type"));
    }

    const setupInput = String(formData.get("setupInput") ?? "").trim();
    if (!setupInput) {
      redirect(diagnosticErr(sessionId, "empty_response"));
    }

    const evaluation = evaluateSetup({
      prompt: q.prompt ?? "",
      canonicalSolution: q.canonical_solution ?? "",
      setupInput
    });
    correct = isCorrectState(evaluation.state);
    evaluationFailed = evaluation.state === "UNSCORABLE" && evaluation.reason !== "empty_response";

    response = {
      type: "SETUP",
      setupInput,
      evaluation: {
        state: evaluation.state,
        reason: evaluation.reason,
        feedback: evaluation.feedback,
        source: evaluation.source
      }
    };
  } else if (type === "EXPLAIN") {
    if (q.type !== "EXPLAIN") {
      redirect(diagnosticErr(sessionId, "wrong_type"));
    }

    const explainInput = String(formData.get("explainInput") ?? "").trim();
    if (!explainInput) {
      redirect(diagnosticErr(sessionId, "empty_response"));
    }

    const evaluation = await evaluateExplain({
      prompt: q.prompt ?? "",
      canonicalSolution: q.canonical_solution ?? "",
      explainInput
    });
    correct = isCorrectState(evaluation.state);
    evaluationFailed = evaluation.reason === "ai_unavailable";

    response = {
      type: "EXPLAIN",
      explainInput,
      evaluation: {
        state: evaluation.state,
        reason: evaluation.reason,
        feedback: evaluation.feedback,
        source: evaluation.source
      },
      grounding: {
        canonicalSolutionUsed: !!evaluation.canonicalSolutionUsed,
        grounded_quotes: evaluation.grounded_quotes ?? []
      }
    };
  } else {
    redirect(diagnosticErr(sessionId, "unsupported_type"));
  }

  const { error: attemptErr } = await supabase.from("attempts").insert({
    user_id: userData.user.id,
    session_id: sessionId,
    question_id: questionId,
    correct,
    response
  } as any);

  if (attemptErr) {
    redirect(diagnosticErr(sessionId, "attempt_insert"));
  }

  const microSkillIds = asStringArray(q.micro_skill_ids);
  if (microSkillIds.length > 0) {
    const { data: masteryRows, error: masteryErr } = await supabase
      .from("mastery")
      .select("micro_skill_id, mastery_score")
      .eq("user_id", userData.user.id)
      .in("micro_skill_id", microSkillIds);

    if (!masteryErr && masteryRows) {
      for (const row of masteryRows as Array<{ micro_skill_id: string; mastery_score: number }>) {
        const oldScore = Number(row.mastery_score ?? 0.3);
        const newScore = updateMasteryScoreWithDifficulty(
          oldScore,
          correct,
          Number(q.difficulty ?? 1)
        );

        await supabase
          .from("mastery")
          .update({ mastery_score: newScore })
          .eq("user_id", userData.user.id)
          .eq("micro_skill_id", row.micro_skill_id);
      }
    }
  }

  const { data: attempts, error: attemptsErr } = await supabase
    .from("attempts")
    .select("id")
    .eq("user_id", userData.user.id)
    .eq("session_id", sessionId);

  const attemptCount = attemptsErr ? 0 : attempts?.length ?? 0;

  if (attemptCount >= DIAGNOSTIC_QUESTION_LIMIT) {
    await supabase
      .from("sessions")
      .update({ ended_at: new Date().toISOString() })
      .eq("id", sessionId)
      .eq("user_id", userData.user.id);

    const params = new URLSearchParams({ session: sessionId, complete: "1" });
    if (evaluationFailed) {
      params.set("err", "evaluation_failed");
    }
    redirect(`/diagnostic?${params.toString()}`);
  }

  redirect(
    buildDiagnosticProgressRedirect(
      sessionId,
      questionId,
      correct,
      evaluationFailed ? "evaluation_failed" : undefined
    )
  );
}

