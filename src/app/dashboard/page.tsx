import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { hasCompletedDiagnosticSession } from "@/lib/learning/diagnostic";
import { LogoutButton } from "./LogoutButton";
import { TopicCard } from "./TopicCard";

type TopicRow = {
  id: string;
  name: string;
  order: number;
  prerequisite_topic_ids: any;
};

type MasteryRow = {
  micro_skill_id: string;
  mastery_score: number;
};

type QuestionRow = {
  id: string;
  topic_id: string;
  micro_skill_ids: any;
};

function asStringArray(v: any): string[] {
  if (!v) return [];
  if (Array.isArray(v)) return v.filter(x => typeof x === "string");
  return [];
}

export default async function DashboardPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;

  const supabase = await createSupabaseServerClient();

  const { data: userData } = await supabase.auth.getUser();
  if (!userData?.user) redirect("/login");

  const diagnosticCompleteFlag = String(sp.diag ?? "") === "complete";

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

  const hasCompletedDiagnostic = await hasCompletedDiagnosticSession(
    supabase,
    userData.user.id
  );

  const [
    { data: topics, error: topicsErr },
    { data: mastery, error: masteryErr },
    { data: questions, error: questionsErr }
  ] = await Promise.all([
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

  const topicSkillSets = new Map<string, Set<string>>();
  for (const q of questionRows) {
    const skills = asStringArray(q.micro_skill_ids);
    if (!topicSkillSets.has(q.topic_id)) topicSkillSets.set(q.topic_id, new Set());
    const set = topicSkillSets.get(q.topic_id)!;
    for (const s of skills) set.add(s);
  }

  const topicProgress = new Map<string, number>();
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

  const COMPLETE_AT = 0.75;
  const isComplete = (topicId: string) => (topicProgress.get(topicId) ?? 0) >= COMPLETE_AT;

  const unlockedMap = new Map<string, boolean>();
  for (const t of topicRows) {
    const prereqs = asStringArray(t.prerequisite_topic_ids);
    const unlocked = prereqs.length === 0 ? true : prereqs.every(pid => isComplete(pid));
    unlockedMap.set(t.id, unlocked);
  }

  const nextTopic =
    topicRows.find(t => unlockedMap.get(t.id) && !isComplete(t.id)) ?? topicRows[0];

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

      {!hasCompletedDiagnostic && (
        <section
          style={{
            marginTop: 18,
            padding: 14,
            border: "1px solid #ddd",
            borderRadius: 10,
            background: "#fffaf0"
          }}
        >
          <div style={{ fontWeight: 700 }}>Diagnostic required</div>
          <p style={{ marginTop: 6, marginBottom: 10, color: "#555" }}>
            Complete your 15-question diagnostic to unlock lesson mode.
          </p>
          <a
            href="/diagnostic"
            style={{
              display: "inline-block",
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid #ddd",
              textDecoration: "none",
              color: "#111"
            }}
          >
            Start diagnostic
          </a>
        </section>
      )}

      {diagnosticCompleteFlag && (
        <section
          style={{
            marginTop: 18,
            padding: 14,
            border: "1px solid #ddd",
            borderRadius: 10,
            background: "#eef9f2"
          }}
        >
          Diagnostic complete. Your learning topics are unlocked.
        </section>
      )}

      <section style={{ marginTop: 18, padding: 14, border: "1px solid #ddd", borderRadius: 10 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 12, color: "#666" }}>Overall mastery</div>
            <div style={{ fontSize: 22, fontWeight: 800 }}>{Math.round(avgMastery * 100)}%</div>
          </div>

          {nextTopic && (
            <a
              href={hasCompletedDiagnostic ? `/learn/${nextTopic.id}` : "/diagnostic"}
              style={{
                display: "inline-block",
                padding: "10px 12px",
                borderRadius: 10,
                border: "1px solid #ddd",
                textDecoration: "none",
                color: "#111"
              }}
            >
              {hasCompletedDiagnostic
                ? `Continue: Topic ${nextTopic.order}`
                : "Complete diagnostic first"}
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
                href={hasCompletedDiagnostic ? `/learn/${t.id}` : "/diagnostic"}
                ctaLabel={hasCompletedDiagnostic ? "Start or continue" : "Diagnostic required"}
              />
            );
          })}
        </div>

        <p style={{ marginTop: 14, color: "#666", fontSize: 12 }}>
          Topic progress is calculated as the average mastery of the micro-skills that appear in that topic's questions.
          Completion threshold is {Math.round(COMPLETE_AT * 100)}%.
        </p>
      </section>
    </main>
  );
}
