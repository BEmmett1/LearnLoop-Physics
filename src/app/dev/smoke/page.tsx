import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function SmokePage() {
  const supabase = await createSupabaseServerClient();

  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) redirect("/login?next=/dev/smoke");

  const { error } = await supabase.rpc("init_user_progress");

  return (
    <main style={{ padding: 24, maxWidth: 720, margin: "0 auto" }}>
      <h1>Smoke Test</h1>
      <p>Signed in as: {auth.user.email}</p>

      {error ? (
        <div style={{ padding: 12, border: "1px solid #ddd", borderRadius: 10 }}>
          <div style={{ fontWeight: 700 }}>RPC failed</div>
          <pre style={{ whiteSpace: "pre-wrap" }}>{error.message}</pre>
        </div>
      ) : (
        <div style={{ padding: 12, border: "1px solid #ddd", borderRadius: 10 }}>
          <div style={{ fontWeight: 700 }}>OK</div>
          <div>init_user_progress executed successfully in authenticated context.</div>
        </div>
      )}
    </main>
  );
}