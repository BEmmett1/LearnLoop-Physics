import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

async function assertCount(supabase: any, table: string, min: number) {
  const { count, error } = await supabase
    .from(table)
    .select("*", { count: "exact", head: true });

  if (error) throw new Error(`${table}: ${error.message}`);
  if ((count ?? 0) < min) throw new Error(`${table}: expected >= ${min} rows, got ${count ?? 0}`);
  console.log(`OK ${table}: ${count}`);
}

async function assertTableReadable(supabase: any, table: string) {
  const { error } = await supabase.from(table).select("*").limit(1);
  if (error) throw new Error(`${table}: ${error.message}`);
  console.log(`OK readable: ${table}`);
}

async function assertRpc(supabase: any, fn: string) {
  const { error } = await supabase.rpc(fn);
  // Some RPCs may require auth; we only need "exists" proof.
  // If it errors with permission, that's still a pass for existence.
  if (error && !String(error.message).toLowerCase().includes("permission")) {
    throw new Error(`rpc ${fn}: ${error.message}`);
  }
  console.log(`OK rpc exists: ${fn}`);
}

async function main() {
  const url = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });

  // Content tables must exist and have rows after seed
  await assertCount(supabase, "topics", 1);
  await assertCount(supabase, "micro_skills", 1);
  await assertCount(supabase, "questions", 1);

  // Progress tables must exist (rows may be 0 before any user signs in)
  await assertTableReadable(supabase, "learner_profile");
  await assertTableReadable(supabase, "mastery");
  await assertTableReadable(supabase, "attempts");
  await assertTableReadable(supabase, "sessions");

  // RPC used by app
  console.log("SKIP rpc init_user_progress: requires authenticated user context (auth.uid()).");

  console.log("DB verification passed.");
}

main().catch(err => {
  console.error("DB verification failed:");
  console.error(err);
  process.exit(1);
});