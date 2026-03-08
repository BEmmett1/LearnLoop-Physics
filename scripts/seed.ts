import "dotenv/config";
import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";

type Topic = {
  id: string;
  name: string;
  order: number;
  prerequisite_topic_ids: string[];
};

type MicroSkill = {
  id: string;
  name: string;
};

type Question = {
  id: string;
  topic_id: string;
  type: "MCQ" | "NUMERIC" | "SETUP" | "EXPLAIN";
  difficulty: 1 | 2 | 3;
  prompt: string;

  // MCQ
  choices: string[] | null;
  correct_choice_index: number | null;

  // Display
  correct_answer_text: string;

  // Numeric
  numeric_answer: number | null;
  numeric_tolerance: number | null;

  canonical_solution: string;
  micro_skill_ids: string[];

  // Tutor features
  hints: string[] | null;

  // Flexible misconception structure
  misconceptions: any[] | null;
};

function readJson<T>(relativePath: string): T {
  const filePath = path.join(process.cwd(), relativePath);
  console.log(`Reading JSON: ${relativePath}`);
  const raw = fs.readFileSync(filePath, "utf8");
  return JSON.parse(raw) as T;
}


function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

async function upsertAll(
  supabase: any,
  table: string,
  rows: any[],
  conflictTarget: string
) {
  const { error } = await supabase
    .from(table)
    .upsert(rows, { onConflict: conflictTarget });

  if (error) {
    throw new Error(`Upsert failed for ${table}: ${error.message}`);
  }
}



async function main() {
  const url = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");

  const supabase: any = createClient(url, serviceKey, {
    auth: { persistSession: false }
  });


  const topics = readJson<Topic[]>("content/physics/topics.json");
  const microSkills = readJson<MicroSkill[]>("content/physics/micro_skills.json");
  const questions = readJson<Question[]>("content/physics/questions.json");

  // Table names: update here if your schema uses different names
  const TOPICS_TABLE = "topics";
  const MICRO_SKILLS_TABLE = "micro_skills";
  const QUESTIONS_TABLE = "questions";

  // Recommended DB columns:
  // topics: id (pk), name, "order", prerequisite_topic_ids (jsonb or text[])
  // micro_skills: id (pk), name
  // questions: id (pk), topic_id (fk), type, difficulty, prompt, choices (jsonb),
  // correct_choice_index, correct_answer_text, numeric_answer, numeric_tolerance,
  // canonical_solution, micro_skill_ids (jsonb or text[]), misconceptions (jsonb)

  console.log(`Seeding topics: ${topics.length}`);
  await upsertAll(supabase, TOPICS_TABLE, topics, "id");

  console.log(`Seeding micro skills: ${microSkills.length}`);
  await upsertAll(supabase, MICRO_SKILLS_TABLE, microSkills, "id");

  // Normalize a couple fields to ensure nulls are present where expected
  const normalizedQuestions = questions.map(q => ({
    ...q,
    choices: q.choices ?? null,
    misconceptions: q.misconceptions ?? null,
    hints: q.hints ?? null
  }));
  console.log(`Seeding questions: ${normalizedQuestions.length}`);
  await upsertAll(supabase, QUESTIONS_TABLE, normalizedQuestions, "id");

  console.log("Seed complete.");
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
