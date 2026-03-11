"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function login() {
    setError(null);
    setMsg(null);
    setLoading(true);

    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    setLoading(false);
    if (error) return setError(error.message);

    router.push("/dashboard");
    router.refresh();
  }

  async function signup() {
    setError(null);
    setMsg(null);
    setLoading(true);

    const supabase = createSupabaseBrowserClient();
    const { data, error } = await supabase.auth.signUp({ email, password });

    setLoading(false);
    if (error) return setError(error.message);

    // If email confirmations are enabled, user may be null until confirmed.
    if (!data.user) {
      setMsg("Signup created. Check your email to confirm, then log in.");
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <main style={{ padding: 24, maxWidth: 420 }}>
      <h1>Login</h1>

      <div style={{ display: "grid", gap: 12, marginTop: 16 }}>
        <label style={{ display: "grid", gap: 6 }}>
          Email
          <input
            value={email}
            onChange={e => setEmail(e.target.value)}
            type="email"
            autoComplete="email"
            style={{ padding: 10 }}
          />
        </label>

        <label style={{ display: "grid", gap: 6 }}>
          Password
          <input
            value={password}
            onChange={e => setPassword(e.target.value)}
            type="password"
            autoComplete="current-password"
            style={{ padding: 10 }}
          />
        </label>

        {msg && <div style={{ background: "#eef", padding: 10 }}>{msg}</div>}
        {error && <div style={{ background: "#fee", padding: 10 }}>{error}</div>}

        <button onClick={login} disabled={loading} style={{ padding: 10 }}>
          {loading ? "Working..." : "Log in"}
        </button>

        <button onClick={signup} disabled={loading} style={{ padding: 10 }}>
          {loading ? "Working..." : "Sign up"}
        </button>
      </div>
    </main>
  );
}
