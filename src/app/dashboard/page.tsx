import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { LogoutButton } from "./LogoutButton";
import { TopicCard } from "./TopicCard";

type TopicRow = {
  id: string;
  name: string;
  order: number;
  prerequisite_topic_ids: any; // jsonb, usually string[]
};

type MasteryRow = {
  micro_skill_id: string;
  mastery_score: number;
};

type QuestionRow = {
  id: string;
  topic_id: string;
  micro_skill_ids: any; // jsonb array
};

function asStringArray(v: any): string[] {
  if (!v) return [];
  if (Array.isArray(v)) return v.filter(x => typeof x === "string");
  return [];
}

export default async function DashboardPage() {
  const supabase = await createSupabaseServerClient();

  const { data: userData } = await supabase.auth.getUser();
  if (!userData?.user) redirect("/login");

  // Initialize user progress (idempotent)
  const { error: initErr } = await supabase.rpc("init_user_progress");
  if (initErr) {
    return (
      <main style={{ padding: 24 }}>
        <h1>Dashboard</h1>
        <p>Failed to initialize progress.</p>
        <pre>{initErr.message}</pre>
      </main>
    );
  }

  // Fetch topics, mastery, and question skill mappings
  const [{ data: topics, error: topicsErr }, { data: mastery, error: masteryErr }, { data: questions, error: questionsErr }] =
    await Promise.all([
      supabase.from("topics").select("id,name,order,prerequisite_topic_ids").order("order"),
      supabase.from("mastery").select("micro_skill_id,mastery_score").order("micro_skill_id"),
      supabase.from("questions").select("id,topic_id,micro_skill_ids")
    ]);

  if (topicsErr || masteryErr || questionsErr) {
    return (
      <main style={{ padding: 24 }}>
        <h1>Dashboard</h1>
        <p>Data load error.</p>
        <pre>{topicsErr?.message ?? masteryErr?.message ?? questionsErr?.message}</pre>
      </main>
    );
  }

  const topicRows = (topics ?? []) as TopicRow[];
  const masteryRows = (mastery ?? []) as MasteryRow[];
  const questionRows = (questions ?? []) as QuestionRow[];

  const masteryMap = new Map<string, number>();
  for (const m of masteryRows) masteryMap.set(m.micro_skill_id, m.mastery_score ?? 0);

  // Build: topicId -> set of microSkillIds used in that topic’s questions
  const topicSkillSets = new Map<string, Set<string>>();
  for (const q of questionRows) {
    const skills = asStringArray(q.micro_skill_ids);
    if (!topicSkillSets.has(q.topic_id)) topicSkillSets.set(q.topic_id, new Set());
    const set = topicSkillSets.get(q.topic_id)!;
    for (const s of skills) set.add(s);
  }

  // Compute progress per topic as average mastery of its micro-skills
  const topicProgress = new Map<string, number>(); // 0..1
  for (const t of topicRows) {
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

  // Completion threshold for topic mastery
  const COMPLETE_AT = 0.75;

  const isComplete = (topicId: string) => (topicProgress.get(topicId) ?? 0) >= COMPLETE_AT;

  // Unlocked if all prerequisite topics are complete (or no prereqs)
  const unlockedMap = new Map<string, boolean>();
  for (const t of topicRows) {
    const prereqs = asStringArray(t.prerequisite_topic_ids);
    const unlocked = prereqs.length === 0 ? true : prereqs.every(pid => isComplete(pid));
    unlockedMap.set(t.id, unlocked);
  }

  // Pick next topic to continue: first unlocked and not complete, else first topic
  const nextTopic =
    topicRows.find(t => unlockedMap.get(t.id) && !isComplete(t.id)) ??
    topicRows[0];

  const avgMastery =
    masteryRows.length > 0
      ? masteryRows.reduce((sum, r) => sum + (r.mastery_score ?? 0), 0) / masteryRows.length
      : 0;

  return (
    <main style={{ padding: 24, maxWidth: 980, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <div>
          <h1 style={{ margin: 0 }}>Dashboard</h1>
          <div style={{ color: "#666", marginTop: 6 }}>
            Signed in as: {userData.user.email ?? userData.user.id}
          </div>
        </div>
        <LogoutButton />
      </div>

      <section style={{ marginTop: 18, padding: 14, border: "1px solid #ddd", borderRadius: 10 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 12, color: "#666" }}>Overall mastery</div>
            <div style={{ fontSize: 22, fontWeight: 800 }}>{Math.round(avgMastery * 100)}%</div>
          </div>

          {nextTopic && (
            <a
              href={`/learn/${nextTopic.id}`}
              style={{
                display: "inline-block",
                padding: "10px 12px",
                borderRadius: 10,
                border: "1px solid #ddd",
                textDecoration: "none",
                color: "#111"
              }}
            >
              Continue: Topic {nextTopic.order}
            </a>
          )}
        </div>
      </section>

      <section style={{ marginTop: 18 }}>
        <h2 style={{ marginBottom: 10 }}>Topics</h2>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 12 }}>
          {topicRows.map(t => {
            const prereqs = asStringArray(t.prerequisite_topic_ids);
            const unlocked = unlockedMap.get(t.id) ?? false;
            const progressPct = (topicProgress.get(t.id) ?? 0) * 100;

            return (
              <TopicCard
                key={t.id}
                id={t.id}
                name={t.name}
                order={t.order}
                unlocked={unlocked}
                progressPct={progressPct}
                prereqIds={prereqs}
              />
            );
          })}
        </div>

        <p style={{ marginTop: 14, color: "#666", fontSize: 12 }}>
          Topic progress is calculated as the average mastery of the micro-skills that appear in that topic’s questions.
          Completion threshold is {Math.round(COMPLETE_AT * 100)}%.
        </p>
      </section>
    </main>
  );
}
