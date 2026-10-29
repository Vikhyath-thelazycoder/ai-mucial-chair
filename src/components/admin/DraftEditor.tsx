"use client";

import { Button } from "@/components/ui/Button";
import { questionSchema, type QuestionInput } from "@/lib/questions/csv";

export type Draft = QuestionInput & { key: string; include: boolean };

let counter = 0;
export const toDrafts = (qs: QuestionInput[]): Draft[] => qs.map((q) => ({ ...q, key: `d${++counter}`, include: true }));
export const blankDraft = (): Draft => ({
  key: `d${++counter}`,
  include: true,
  text: "",
  type: "mcq",
  options: ["", "", "", ""],
  answer: "",
  alternatives: [],
  difficulty: 2,
  topic: "general",
});

export function draftProblem(d: Draft): string | null {
  const r = questionSchema.safeParse({ ...d, options: d.type === "mcq" ? (d.options ?? []).map((o) => o.trim()).filter(Boolean) : null });
  return r.success ? null : r.error.issues[0].message;
}

const input = "min-h-10 w-full rounded-lg border border-line bg-bg px-2 text-sm outline-none focus:border-cyan";

/** Review table: the admin checks every AI/CSV/manual question before it's saved (D-008). */
export function DraftEditor({
  drafts,
  onChange,
  onSave,
  onDiscard,
  saving,
}: {
  drafts: Draft[];
  onChange: (d: Draft[]) => void;
  onSave: () => void;
  onDiscard: () => void;
  saving: boolean;
}) {
  const update = (key: string, patch: Partial<Draft>) => onChange(drafts.map((d) => (d.key === key ? { ...d, ...patch } : d)));
  const selected = drafts.filter((d) => d.include);
  const blocking = selected.filter((d) => draftProblem(d)).length;

  return (
    <section className="rounded-2xl border border-cyan/50 bg-surface p-4" aria-label="Questions to review">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-bold">Review before saving · {drafts.length} question(s)</h2>
          <p className="text-sm text-muted">Fix anything that looks wrong. Untick a question to leave it out. Nothing is saved until you press Save.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={onDiscard}>
            Discard all
          </Button>
          <Button onClick={onSave} disabled={saving || selected.length === 0 || blocking > 0}>
            {saving ? "Saving…" : `Save ${selected.length} question(s)`}
          </Button>
        </div>
      </div>
      {blocking > 0 && <p className="mt-2 text-sm text-amber">{blocking} ticked question(s) need fixing (see the red notes) or unticking.</p>}

      <ol className="mt-4 flex flex-col gap-3">
        {drafts.map((d, i) => {
          const problem = draftProblem(d);
          const options = d.options ?? [];
          return (
            <li key={d.key} className={`rounded-xl border p-3 ${!d.include ? "border-line opacity-50" : problem ? "border-red/60" : "border-line"}`}>
              <div className="flex flex-wrap items-start gap-3">
                <label className="flex min-h-10 items-center gap-2 text-sm">
                  <input type="checkbox" checked={d.include} onChange={(e) => update(d.key, { include: e.target.checked })} />
                  <span className="font-mono text-muted">{i + 1}</span>
                </label>
                <label className="min-w-0 flex-[999_1_320px] text-xs text-muted">
                  Question
                  <textarea value={d.text} rows={2} maxLength={300} onChange={(e) => update(d.key, { text: e.target.value })} className={`${input} py-1.5 text-text`} />
                </label>
                <label className="w-24 text-xs text-muted">
                  Difficulty
                  <select value={d.difficulty} onChange={(e) => update(d.key, { difficulty: Number(e.target.value) })} className={`${input} text-text`}>
                    {[1, 2, 3, 4, 5].map((n) => (
                      <option key={n}>{n}</option>
                    ))}
                  </select>
                </label>
                <label className="w-36 text-xs text-muted">
                  Topic
                  <input value={d.topic} maxLength={60} onChange={(e) => update(d.key, { topic: e.target.value })} className={`${input} text-text`} />
                </label>
              </div>

              <fieldset className="mt-3 grid gap-2 sm:grid-cols-2">
                <legend className="mb-1 text-xs text-muted">Options: pick the correct one</legend>
                {options.map((opt, oi) => (
                  <div key={oi} className="flex items-center gap-2">
                    <input
                      type="radio"
                      name={`answer-${d.key}`}
                      aria-label={`Option ${String.fromCharCode(65 + oi)} is correct`}
                      checked={opt !== "" && d.answer === opt}
                      onChange={() => update(d.key, { answer: opt })}
                    />
                    <input
                      value={opt}
                      maxLength={60}
                      aria-label={`Option ${String.fromCharCode(65 + oi)}`}
                      onChange={(e) => {
                        const next = [...options];
                        next[oi] = e.target.value;
                        update(d.key, { options: next, answer: d.answer === opt ? e.target.value : d.answer });
                      }}
                      className={`${input} text-text`}
                    />
                  </div>
                ))}
              </fieldset>
              {d.include && problem && <p className="mt-2 text-xs text-red">{problem}</p>}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
