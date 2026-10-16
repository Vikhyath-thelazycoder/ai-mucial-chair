"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Field } from "@/components/player/Field";
import { Button } from "@/components/ui/Button";
import { Panel } from "@/components/ui/Panel";
import { isAdmin } from "@/lib/admin/session";
import { friendlyError } from "@/lib/errors";
import { getBrowserSupabase } from "@/lib/supabase/client";

export function AdminLogin({ denied }: { denied: boolean }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(denied ? "That account isn't an admin." : null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const sb = getBrowserSupabase();
    const { error: signInError } = await sb.auth.signInWithPassword({ email: email.trim(), password });
    if (signInError) {
      setBusy(false);
      return setError(signInError.message === "Invalid login credentials" ? "Wrong email or password." : friendlyError(signInError.message));
    }
    if (!(await isAdmin(sb))) {
      await sb.auth.signOut();
      setBusy(false);
      return setError("That account isn't an admin.");
    }
    router.replace("/admin");
    router.refresh();
  };

  return (
    <Panel className="w-full max-w-sm p-6">
      <p className="font-display text-xs tracking-[0.2em] text-muted">AI MUSICAL CHAIR</p>
      <h1 className="mt-1 text-2xl font-bold">Admin login</h1>
      <form onSubmit={submit} className="mt-6 flex flex-col gap-4">
        <Field label="Email" name="email" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <Field label="Password" name="password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        {error && <p role="alert" className="rounded-xl bg-red/10 p-3 text-sm text-red">{error}</p>}
        <Button type="submit" size="lg" disabled={busy}>
          {busy ? "Signing in…" : "Sign in"}
        </Button>
      </form>
    </Panel>
  );
}
