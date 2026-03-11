"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  gradeMcqAnswer,
  gradeNumericAnswer,
  updateMasteryScore
} from "@/lib/learning/grading";

export async function submitMcqAttempt(formData: FormData) {
  const topicId = String(formData.get("topicId") ?? "");
  const questionId = String(formData.get("questionId") ?? "");
  const selectedStr = String(formData.get("selectedChoiceIndex") ?? "");
  const selectedChoiceIndex = selectedStr === "" ? null : Number(selectedStr);

  if (!topicId || !questionId) {
    redirect(`/dashboard`);
  }

  const supabase = await createSupabaseServerClient();

  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userData?.user) {
    redirect("/login");
  }

  // Load the question to grade it
  const { data: q, error: qErr } = await supabase
    .from("questions")
    .select("id, topic_id, type, correct_choice_index, micro_skill_ids")
    .eq("id", questionId)
    .single();

  if (qErr || !q) {
    redirect(`/learn/${topicId}?err=question_not_found`);
  }

  // Basic guard
  if (q.topic_id !== topicId) {
    redirect(`/learn/${topicId}?err=topic_mismatch`);
  }

  // Grade MCQ
  const correctIndex = q.correct_choice_index as number | null;
  const correct = gradeMcqAnswer(selectedChoiceIndex, correctIndex);

  // Write attempt (RLS: user_id is set to auth.uid via our code)
  const { error: attemptErr } = await supabase.from("attempts").insert({
    user_id: userData.user.id,
    question_id: questionId,
    correct,
    response: { selectedChoiceIndex }
  } as any);

  if (attemptErr) {
    redirect(`/learn/${topicId}?err=attempt_insert&msg=${encodeURIComponent(attemptErr.message)}`);
  }

  // Update mastery rows for all micro-skills on this question
  const microSkillIds = Array.isArray(q.micro_skill_ids) ? q.micro_skill_ids : [];
  const ids = microSkillIds.filter((x: any) => typeof x === "string") as string[];

  if (ids.length > 0) {
    const { data: masteryRows, error: masteryErr } = await supabase
      .from("mastery")
      .select("micro_skill_id, mastery_score")
      .eq("user_id", userData.user.id)
      .in("micro_skill_id", ids);

    if (!masteryErr && masteryRows) {
      for (const row of masteryRows as any[]) {
        const oldScore = Number(row.mastery_score ?? 0.3);
        const newScore = updateMasteryScore(oldScore, correct);

        await supabase
          .from("mastery")
          .update({ mastery_score: newScore })
          .eq("user_id", userData.user.id)
          .eq("micro_skill_id", row.micro_skill_id);
      }
    }
  }

  redirect(`/learn/${topicId}?last=${encodeURIComponent(questionId)}&correct=${correct ? "1" : "0"}`);
}

export async function submitNumericAttempt(formData: FormData) {
  const topicId = String(formData.get("topicId") ?? "");
  const questionId = String(formData.get("questionId") ?? "");
  const inputStr = String(formData.get("numericInput") ?? "").trim();

  if (!topicId || !questionId) redirect("/dashboard");

  const supabase = await createSupabaseServerClient();

  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userData?.user) redirect("/login");

  const input = inputStr === "" ? null : Number(inputStr);
  if (inputStr !== "" && Number.isNaN(input)) {
    redirect(`/learn/${topicId}?err=bad_number`);
  }

  const { data: q, error: qErr } = await supabase
    .from("questions")
    .select("id, topic_id, type, numeric_answer, numeric_tolerance, micro_skill_ids")
    .eq("id", questionId)
    .single();

  if (qErr || !q) redirect(`/learn/${topicId}?err=question_not_found`);
  if (q.topic_id !== topicId) redirect(`/learn/${topicId}?err=topic_mismatch`);
  if (q.type !== "NUMERIC") redirect(`/learn/${topicId}?err=wrong_type`);

  const ans = q.numeric_answer as number | null;
  const tol = q.numeric_tolerance as number | null;
  const correct = gradeNumericAnswer(input, ans, tol);

  const { error: attemptErr } = await supabase.from("attempts").insert({
    user_id: userData.user.id,
    question_id: questionId,
    correct,
    response: { numericInput: inputStr }
  } as any);

  if (attemptErr) {
    redirect(`/learn/${topicId}?err=attempt_insert&msg=${encodeURIComponent(attemptErr.message)}`);
  }

  const microSkillIds = Array.isArray(q.micro_skill_ids) ? q.micro_skill_ids : [];
  const ids = microSkillIds.filter((x: any) => typeof x === "string") as string[];

  if (ids.length > 0) {
    const { data: masteryRows } = await supabase
      .from("mastery")
      .select("micro_skill_id, mastery_score")
      .eq("user_id", userData.user.id)
      .in("micro_skill_id", ids);

    if (masteryRows) {
      for (const row of masteryRows as any[]) {
        const oldScore = Number(row.mastery_score ?? 0.3);
        const newScore = updateMasteryScore(oldScore, correct);

        await supabase
          .from("mastery")
          .update({ mastery_score: newScore })
          .eq("user_id", userData.user.id)
          .eq("micro_skill_id", row.micro_skill_id);
      }
    }
  }

  redirect(`/learn/${topicId}?last=${encodeURIComponent(questionId)}&correct=${correct ? "1" : "0"}`);
}
