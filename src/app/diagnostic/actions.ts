"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  gradeMcqAnswer,
  gradeNumericAnswer
} from "@/lib/learning/grading";
import {
  DIAGNOSTIC_QUESTION_LIMIT,
  hasCompletedDiagnosticSession,
  updateMasteryScoreWithDifficulty
} from "@/lib/learning/diagnostic";

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
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
    .select("id, type, difficulty, correct_choice_index, numeric_answer, numeric_tolerance, micro_skill_ids")
    .eq("id", questionId)
    .single();

  if (questionErr || !question) {
    redirect(`/diagnostic?session=${encodeURIComponent(sessionId)}&err=question_not_found`);
  }

  let correct = false;
  let response: Record<string, unknown> = {};

  if (type === "MCQ") {
    if (question.type !== "MCQ") {
      redirect(`/diagnostic?session=${encodeURIComponent(sessionId)}&err=wrong_type`);
    }

    const selectedStr = String(formData.get("selectedChoiceIndex") ?? "");
    const selectedChoiceIndex = selectedStr === "" ? null : Number(selectedStr);
    correct = gradeMcqAnswer(selectedChoiceIndex, question.correct_choice_index as number | null);
    response = { selectedChoiceIndex };
  } else if (type === "NUMERIC") {
    if (question.type !== "NUMERIC") {
      redirect(`/diagnostic?session=${encodeURIComponent(sessionId)}&err=wrong_type`);
    }

    const inputStr = String(formData.get("numericInput") ?? "").trim();
    const input = inputStr === "" ? null : Number(inputStr);
    if (inputStr !== "" && Number.isNaN(input)) {
      redirect(`/diagnostic?session=${encodeURIComponent(sessionId)}&err=bad_number`);
    }

    correct = gradeNumericAnswer(
      input,
      question.numeric_answer as number | null,
      question.numeric_tolerance as number | null
    );
    response = { numericInput: inputStr };
  } else {
    redirect(`/diagnostic?session=${encodeURIComponent(sessionId)}&err=unsupported_type`);
  }

  const { error: attemptErr } = await supabase.from("attempts").insert({
    user_id: userData.user.id,
    session_id: sessionId,
    question_id: questionId,
    correct,
    response
  } as any);

  if (attemptErr) {
    redirect(`/diagnostic?session=${encodeURIComponent(sessionId)}&err=attempt_insert`);
  }

  const microSkillIds = asStringArray(question.micro_skill_ids);
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
          Number(question.difficulty ?? 1)
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

    redirect(`/diagnostic?session=${encodeURIComponent(sessionId)}&complete=1`);
  }

  redirect(
    `/diagnostic?session=${encodeURIComponent(sessionId)}&last=${encodeURIComponent(
      questionId
    )}&correct=${correct ? "1" : "0"}`
  );
}
