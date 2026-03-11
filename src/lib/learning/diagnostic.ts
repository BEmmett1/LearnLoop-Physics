import { clamp01 } from "./grading";

export const DIAGNOSTIC_QUESTION_LIMIT = 15;

export type DiagnosticQuestion = {
  id: string;
  type: "MCQ" | "NUMERIC" | "SETUP" | "EXPLAIN";
  difficulty: 1 | 2 | 3;
  micro_skill_ids: unknown;
};

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

export function diagnosticDifficultyMultiplier(difficulty: number) {
  if (difficulty === 2) return 1.25;
  if (difficulty === 3) return 1.5;
  return 1;
}

export function updateMasteryScoreWithDifficulty(
  oldScore: number,
  correct: boolean,
  difficulty: number
) {
  const s = clamp01(oldScore);
  const delta = 0.12 * diagnosticDifficultyMultiplier(difficulty);
  if (correct) return clamp01(s + delta * (1 - s));
  return clamp01(s - delta * s);
}

function pickBestQuestion(
  questions: DiagnosticQuestion[],
  coveredSkillIds: Set<string>
) {
  return [...questions].sort((a, b) => {
    const aSkills = asStringArray(a.micro_skill_ids);
    const bSkills = asStringArray(b.micro_skill_ids);
    const aGain = aSkills.filter(skill => !coveredSkillIds.has(skill)).length;
    const bGain = bSkills.filter(skill => !coveredSkillIds.has(skill)).length;

    if (aGain !== bGain) return bGain - aGain;
    if (a.difficulty !== b.difficulty) return a.difficulty - b.difficulty;
    return a.id.localeCompare(b.id);
  })[0];
}

export function selectDiagnosticQuestions(
  allQuestions: DiagnosticQuestion[],
  limit = DIAGNOSTIC_QUESTION_LIMIT
) {
  const eligible = allQuestions
    .filter(q => q.type === "MCQ" || q.type === "NUMERIC" || q.type === "SETUP" || q.type === "EXPLAIN")
    .sort((a, b) => a.id.localeCompare(b.id));

  const targetCount = Math.min(limit, eligible.length);
  const coveredSkillIds = new Set<string>();
  const selected: DiagnosticQuestion[] = [];
  const remaining = new Map<string, DiagnosticQuestion>(
    eligible.map(question => [question.id, question])
  );
  const cycle: Array<1 | 2 | 3> = [1, 2, 3];
  let cycleIndex = 0;

  while (selected.length < targetCount && remaining.size > 0) {
    const preferredDifficulty = cycle[cycleIndex % cycle.length];
    cycleIndex += 1;

    const matchingDifficulty = [...remaining.values()].filter(
      question => question.difficulty === preferredDifficulty
    );

    const candidate =
      matchingDifficulty.length > 0
        ? pickBestQuestion(matchingDifficulty, coveredSkillIds)
        : pickBestQuestion([...remaining.values()], coveredSkillIds);

    if (!candidate) break;

    selected.push(candidate);
    remaining.delete(candidate.id);
    for (const skillId of asStringArray(candidate.micro_skill_ids)) {
      coveredSkillIds.add(skillId);
    }
  }

  return selected;
}

export async function hasCompletedDiagnosticSession(
  supabase: any,
  userId: string
) {
  const { data: sessions, error: sessionsErr } = await supabase
    .from("sessions")
    .select("id, ended_at")
    .eq("user_id", userId)
    .eq("mode", "DIAGNOSTIC")
    .not("ended_at", "is", null)
    .order("ended_at", { ascending: false })
    .limit(5);

  if (sessionsErr || !sessions || sessions.length === 0) {
    return false;
  }

  for (const session of sessions as Array<{ id: string }>) {
    const { data: attempts, error: attemptsErr } = await supabase
      .from("attempts")
      .select("id")
      .eq("user_id", userId)
      .eq("session_id", session.id);

    if (!attemptsErr && (attempts?.length ?? 0) >= DIAGNOSTIC_QUESTION_LIMIT) {
      return true;
    }
  }

  return false;
}


