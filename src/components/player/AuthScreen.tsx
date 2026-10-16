"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { friendlyError } from "@/lib/errors";
import { loginPlayer, registerPlayer, rejoinCurrentGame } from "@/lib/player/auth";
import { fieldErrors, loginSchema, registrationSchema } from "@/lib/player/validation";
import { getBrowserSupabase } from "@/lib/supabase/client";
import { Field } from "./Field";

const BRANCHES = ["CSE", "ISE", "ECE", "EEE", "ME", "CV", "AI & ML", "CSE (Data Science)", "MBA", "MCA"];

type Details = { name: string; usn: string; phone: string; branch: string };

function BranchList() {
  return (
    <datalist id="branches">
      {BRANCHES.map((b) => (
        <option key={b} value={b} />
      ))}
    </datalist>
  );
}

function useSubmit(action: () => Promise<void>, onDone: () => void) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = async () => {
    setBusy(true);
    setError(null);
    try {
      await action();
      onDone();
    } catch (e) {
      setError(friendlyError(e instanceof Error ? e.message : undefined));
    } finally {
      setBusy(false);
    }
  };
  return { busy, error, run };
}

function RegisterForm({ onDone }: { onDone: () => void }) {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [values, setValues] = useState<Details & { pin: string }>({ name: "", usn: "", phone: "", branch: "", pin: "" });
  const submit = useSubmit(async () => {
    await registerPlayer(getBrowserSupabase(), registrationSchema.parse(values));
  }, onDone);

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const parsed = registrationSchema.safeParse(values);
    if (!parsed.success) return setErrors(fieldErrors(parsed.error));
    setErrors({});
    void submit.run();
  };
  const set = (k: keyof typeof values) => (e: React.ChangeEvent<HTMLInputElement>) => setValues({ ...values, [k]: e.target.value });

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <Field label="Name" name="name" autoComplete="name" value={values.name} onChange={set("name")} error={errors.name} />
      <Field label="USN" name="usn" autoCapitalize="characters" autoComplete="off" placeholder="4SU22CS011" value={values.usn} onChange={set("usn")} error={errors.usn} />
      <Field label="Phone" name="phone" type="tel" inputMode="numeric" autoComplete="tel-national" maxLength={10} value={values.phone} onChange={set("phone")} error={errors.phone} />
      <Field label="Branch" name="branch" list="branches" autoComplete="off" value={values.branch} onChange={set("branch")} error={errors.branch} />
      <BranchList />
      <Field
        label="Create a 6-digit PIN"
        name="pin"
        type="password"
        inputMode="numeric"
        autoComplete="new-password"
        maxLength={6}
        value={values.pin}
        onChange={set("pin")}
        error={errors.pin}
        hint="You'll use your USN and this PIN to log back in."
      />
      {submit.error && <p role="alert" className="rounded-xl bg-red/10 p-3 text-sm text-red">{submit.error}</p>}
      <Button type="submit" size="lg" disabled={submit.busy}>
        {submit.busy ? "Joining…" : "Join the game"}
      </Button>
    </form>
  );
}

function LoginForm({ onDone }: { onDone: () => void }) {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [values, setValues] = useState({ usn: "", pin: "" });
  const submit = useSubmit(async () => {
    await loginPlayer(getBrowserSupabase(), loginSchema.parse(values));
  }, onDone);

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const parsed = loginSchema.safeParse(values);
    if (!parsed.success) return setErrors(fieldErrors(parsed.error));
    setErrors({});
    void submit.run();
  };

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <Field label="USN" name="login-usn" autoCapitalize="characters" autoComplete="username" value={values.usn} onChange={(e) => setValues({ ...values, usn: e.target.value })} error={errors.usn} />
      <Field label="PIN" name="login-pin" type="password" inputMode="numeric" autoComplete="current-password" maxLength={6} value={values.pin} onChange={(e) => setValues({ ...values, pin: e.target.value })} error={errors.pin} />
      {submit.error && <p role="alert" className="rounded-xl bg-red/10 p-3 text-sm text-red">{submit.error}</p>}
      <Button type="submit" size="lg" disabled={submit.busy}>
        {submit.busy ? "Logging in…" : "Log in"}
      </Button>
    </form>
  );
}

/** Signed out: join (new player) or log in (has a PIN). */
export function AuthScreen({ onDone }: { onDone: () => void }) {
  const [tab, setTab] = useState<"join" | "login">("join");
  return (
    <section className="mx-auto flex w-full max-w-md flex-col gap-6">
      <div className="text-center">
        <h1 className="font-display text-3xl font-black tracking-[0.06em]">JOIN THE GAME</h1>
        <p className="mt-2 text-muted">Register once, then scan your chair when the music stops.</p>
      </div>
      <div role="tablist" aria-label="Join or log in" className="grid grid-cols-2 gap-1 rounded-xl border border-line bg-surface p-1">
        {(["join", "login"] as const).map((t) => (
          <button
            key={t}
            role="tab"
            type="button"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={`min-h-11 rounded-lg text-sm font-bold ${tab === t ? "bg-cyan text-bg" : "text-muted"}`}
          >
            {t === "join" ? "New player" : "I have a PIN"}
          </button>
        ))}
      </div>
      {tab === "join" ? <RegisterForm onDone={onDone} /> : <LoginForm onDone={onDone} />}
    </section>
  );
}

/** Signed in from an earlier game: confirm details to join the new one. */
export function RejoinScreen({ prefill, onDone, onLogout }: { prefill: Details | null; onDone: () => void; onLogout: () => void }) {
  const [values, setValues] = useState<Details>(prefill ?? { name: "", usn: "", phone: "", branch: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const schema = registrationSchema.omit({ pin: true });
  const submit = useSubmit(async () => {
    await rejoinCurrentGame(getBrowserSupabase(), schema.parse(values));
  }, onDone);

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse(values);
    if (!parsed.success) return setErrors(fieldErrors(parsed.error));
    setErrors({});
    void submit.run();
  };
  const set = (k: keyof Details) => (e: React.ChangeEvent<HTMLInputElement>) => setValues({ ...values, [k]: e.target.value });

  return (
    <section className="mx-auto flex w-full max-w-md flex-col gap-6">
      <div className="text-center">
        <h1 className="font-display text-3xl font-black tracking-[0.06em]">NEW GAME</h1>
        <p className="mt-2 text-muted">A new game has started. Check your details and join.</p>
      </div>
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        <Field label="Name" name="name" value={values.name} onChange={set("name")} error={errors.name} />
        <Field label="USN" name="usn" value={values.usn} readOnly error={errors.usn} hint="Your USN is tied to your PIN." />
        <Field label="Phone" name="phone" type="tel" inputMode="numeric" maxLength={10} value={values.phone} onChange={set("phone")} error={errors.phone} />
        <Field label="Branch" name="branch" list="branches" value={values.branch} onChange={set("branch")} error={errors.branch} />
        <BranchList />
        {submit.error && <p role="alert" className="rounded-xl bg-red/10 p-3 text-sm text-red">{submit.error}</p>}
        <Button type="submit" size="lg" disabled={submit.busy}>
          {submit.busy ? "Joining…" : "Join this game"}
        </Button>
        <Button variant="ghost" onClick={onLogout}>
          Not you? Log out
        </Button>
      </form>
    </section>
  );
}
