"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { gradeMcqAnswer, gradeNumericAnswer, updateMasteryScore } from "@/lib/learning/grading";
import { evaluateExplain, evaluateSetup, isCorrectState } from "@/lib/learning/text-evaluation";

type LearnQuestionRow = {
  id: string;
  topic_id: string;
  type: "MCQ" | "NUMERIC" | "SETUP" | "EXPLAIN";
  prompt: string | null;
  canonical_solution: string | null;
  correct_choice_index: number | null;
  numeric_answer: number | null;
  numeric_tolerance: number | null;
  micro_skill_ids: unknown;
};

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function buildLearnAttemptRedirect(topicId: string, questionId: string, correct: boolean, errCode?: string) {
  const params = new URLSearchParams({
    last: questionId,
    correct: correct ? "1" : "0"
  });

  if (errCode) {
    params.set("err", errCode);
  }

  return `/learn/${encodeURIComponent(topicId)}?${params.toString()}`;
}

function badRequestRedirect(topicId: string) {
  if (!topicId) {
    redirect("/dashboard");
  }

  redirect(`/learn/${encodeURIComponent(topicId)}?err=bad_request`);
}

async function loadQuestion(supabase: any, questionId: string): Promise<LearnQuestionRow | null> {
  const { data: question, error } = await supabase
    .from("questions")
    .select(
      "id,topic_id,type,prompt,canonical_solution,correct_choice_index,numeric_answer,numeric_tolerance,micro_skill_ids"
    )
    .eq("id", questionId)
    .single();

  if (error || !question) {
    return null;
  }

  return question as LearnQuestionRow;
}

async function updateMasteryRows(
  supabase: any,
  userId: string,
  microSkillIds: unknown,
  correct: boolean
) {
  const ids = asStringArray(microSkillIds);
  if (ids.length === 0) return;

  const { data: masteryRows, error: masteryErr } = await supabase
    .from("mastery")
    .select("micro_skill_id, mastery_score")
    .eq("user_id", userId)
    .in("micro_skill_id", ids);

  if (masteryErr || !masteryRows) return;

  for (const row of masteryRows as Array<{ micro_skill_id: string; mastery_score: number }>) {
    const oldScore = Number(row.mastery_score ?? 0.3);
    const newScore = updateMasteryScore(oldScore, correct);

    await supabase
      .from("mastery")
      .update({ mastery_score: newScore })
      .eq("user_id", userId)
      .eq("micro_skill_id", row.micro_skill_id);
  }
}

export async function submitMcqAttempt(formData: FormData) {
  const topicId = String(formData.get("topicId") ?? "");
  const questionId = String(formData.get("questionId") ?? "");
  const selectedStr = String(formData.get("selectedChoiceIndex") ?? "");
  const selectedChoiceIndex = selectedStr === "" ? null : Number(selectedStr);

  if (!topicId || !questionId) {
    badRequestRedirect(topicId);
  }

  const supabase = await createSupabaseServerClient();

  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userData?.user) {
    redirect("/login");
  }

  const question = await loadQuestion(supabase, questionId);
  if (!question) {
    redirect(`/learn/${encodeURIComponent(topicId)}?err=question_not_found`);
  }

  if (question.topic_id !== topicId) {
    redirect(`/learn/${encodeURIComponent(topicId)}?err=topic_mismatch`);
  }

  if (question.type !== "MCQ") {
    redirect(`/learn/${encodeURIComponent(topicId)}?err=wrong_type`);
  }

  const correct = gradeMcqAnswer(selectedChoiceIndex, question.correct_choice_index);

  const { error: attemptErr } = await supabase.from("attempts").insert({
    user_id: userData.user.id,
    question_id: questionId,
    correct,
    response: { selectedChoiceIndex }
  } as any);

  if (attemptErr) {
    redirect(`/learn/${encodeURIComponent(topicId)}?err=attempt_insert`);
  }

  await updateMasteryRows(supabase, userData.user.id, question.micro_skill_ids, correct);

  redirect(buildLearnAttemptRedirect(topicId, questionId, correct));
}

export async function submitNumericAttempt(formData: FormData) {
  const topicId = String(formData.get("topicId") ?? "");
  const questionId = String(formData.get("questionId") ?? "");
  const inputStr = String(formData.get("numericInput") ?? "").trim();

  if (!topicId || !questionId) {
    badRequestRedirect(topicId);
  }

  const supabase = await createSupabaseServerClient();

  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userData?.user) {
    redirect("/login");
  }

  const input = inputStr === "" ? null : Number(inputStr);
  if (inputStr !== "" && Number.isNaN(input)) {
    redirect(`/learn/${encodeURIComponent(topicId)}?err=bad_number`);
  }

  const question = await loadQuestion(supabase, questionId);
  if (!question) {
    redirect(`/learn/${encodeURIComponent(topicId)}?err=question_not_found`);
  }

  if (question.topic_id !== topicId) {
    redirect(`/learn/${encodeURIComponent(topicId)}?err=topic_mismatch`);
  }

  if (question.type !== "NUMERIC") {
    redirect(`/learn/${encodeURIComponent(topicId)}?err=wrong_type`);
  }

  const correct = gradeNumericAnswer(input, question.numeric_answer, question.numeric_tolerance);

  const { error: attemptErr } = await supabase.from("attempts").insert({
    user_id: userData.user.id,
    question_id: questionId,
    correct,
    response: { numericInput: inputStr }
  } as any);

  if (attemptErr) {
    redirect(`/learn/${encodeURIComponent(topicId)}?err=attempt_insert`);
  }

  await updateMasteryRows(supabase, userData.user.id, question.micro_skill_ids, correct);

  redirect(buildLearnAttemptRedirect(topicId, questionId, correct));
}

export async function submitSetupAttempt(formData: FormData) {
  const topicId = String(formData.get("topicId") ?? "");
  const questionId = String(formData.get("questionId") ?? "");
  const type = String(formData.get("type") ?? "");
  const setupInput = String(formData.get("setupInput") ?? "").trim();

  if (!topicId || !questionId || !type) {
    badRequestRedirect(topicId);
  }

  if (type !== "SETUP") {
    redirect(`/learn/${encodeURIComponent(topicId)}?err=unsupported_type`);
  }

  if (!setupInput) {
    redirect(`/learn/${encodeURIComponent(topicId)}?err=empty_response`);
  }

  const supabase = await createSupabaseServerClient();

  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userData?.user) {
    redirect("/login");
  }

  const question = await loadQuestion(supabase, questionId);
  if (!question) {
    redirect(`/learn/${encodeURIComponent(topicId)}?err=question_not_found`);
  }

  if (question.topic_id !== topicId) {
    redirect(`/learn/${encodeURIComponent(topicId)}?err=topic_mismatch`);
  }

  if (question.type !== "SETUP") {
    redirect(`/learn/${encodeURIComponent(topicId)}?err=wrong_type`);
  }

  const evaluation = evaluateSetup({
    prompt: question.prompt ?? "",
    canonicalSolution: question.canonical_solution ?? "",
    setupInput
  });
  const correct = isCorrectState(evaluation.state);

  const { error: attemptErr } = await supabase.from("attempts").insert({
    user_id: userData.user.id,
    question_id: questionId,
    correct,
    response: {
      type: "SETUP",
      setupInput,
      evaluation: {
        state: evaluation.state,
        reason: evaluation.reason,
        feedback: evaluation.feedback,
        source: evaluation.source
      }
    }
  } as any);

  if (attemptErr) {
    redirect(`/learn/${encodeURIComponent(topicId)}?err=attempt_insert`);
  }

  await updateMasteryRows(supabase, userData.user.id, question.micro_skill_ids, correct);

  const hasEvaluationFailure = evaluation.state === "UNSCORABLE" && evaluation.reason !== "empty_response";
  redirect(buildLearnAttemptRedirect(topicId, questionId, correct, hasEvaluationFailure ? "evaluation_failed" : undefined));
}

export async function submitExplainAttempt(formData: FormData) {
  const topicId = String(formData.get("topicId") ?? "");
  const questionId = String(formData.get("questionId") ?? "");
  const type = String(formData.get("type") ?? "");
  const explainInput = String(formData.get("explainInput") ?? "").trim();

  if (!topicId || !questionId || !type) {
    badRequestRedirect(topicId);
  }

  if (type !== "EXPLAIN") {
    redirect(`/learn/${encodeURIComponent(topicId)}?err=unsupported_type`);
  }

  if (!explainInput) {
    redirect(`/learn/${encodeURIComponent(topicId)}?err=empty_response`);
  }

  const supabase = await createSupabaseServerClient();

  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userData?.user) {
    redirect("/login");
  }

  const question = await loadQuestion(supabase, questionId);
  if (!question) {
    redirect(`/learn/${encodeURIComponent(topicId)}?err=question_not_found`);
  }

  if (question.topic_id !== topicId) {
    redirect(`/learn/${encodeURIComponent(topicId)}?err=topic_mismatch`);
  }

  if (question.type !== "EXPLAIN") {
    redirect(`/learn/${encodeURIComponent(topicId)}?err=wrong_type`);
  }

  const evaluation = await evaluateExplain({
    prompt: question.prompt ?? "",
    canonicalSolution: question.canonical_solution ?? "",
    explainInput
  });
  const correct = isCorrectState(evaluation.state);

  const { error: attemptErr } = await supabase.from("attempts").insert({
    user_id: userData.user.id,
    question_id: questionId,
    correct,
    response: {
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
    }
  } as any);

  if (attemptErr) {
    redirect(`/learn/${encodeURIComponent(topicId)}?err=attempt_insert`);
  }

  await updateMasteryRows(supabase, userData.user.id, question.micro_skill_ids, correct);

  const hasEvaluationFailure = evaluation.reason === "ai_unavailable";
  redirect(buildLearnAttemptRedirect(topicId, questionId, correct, hasEvaluationFailure ? "evaluation_failed" : undefined));
}

