"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Panel } from "@/components/ui/Panel";
import { ACCEPT, MAX_UPLOAD_BYTES } from "@/lib/ai/upload";
import { friendlyError } from "@/lib/errors";
import type { QuestionInput } from "@/lib/questions/csv";
import { getBrowserSupabase } from "@/lib/supabase/client";
import { DraftEditor, blankDraft, draftProblem, toDrafts, type Draft } from "./DraftEditor";
import { Modal } from "./Modal";

type Row = QuestionInput & { id: string; source: string; is_enabled: boolean; created_at: string };
type DraftSource = "ai" | "csv" | "manual";

async function postJson(url: string, init: RequestInit): Promise<{ drafts: QuestionInput[]; rejected: number; source: DraftSource }> {
  const res = await fetch(url, init);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.code ?? (res.status === 413 ? "FILE_TOO_LARGE" : "AI_FAILED"));
  return body;
}

/** Question bank (P5): upload any question file for the AI to read, generate with AI, add by hand, review, save. */
export function QuestionBank() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [draftSource, setDraftSource] = useState<DraftSource>("manual");
  const [busy, setBusy] = useState<null | "upload" | "generate" | "save">(null);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const [dialog, setDialog] = useState<null | "generate" | "upload">(null);
  const [filter, setFilter] = useState({ q: "", difficulty: "all", enabled: "all" });

  const load = useCallback(async () => {
    const { data } = await getBrowserSupabase()
      .from("questions")
      .select("id, text, type, options, answer, alternatives, difficulty, topic, source, is_enabled, created_at")
      .order("created_at", { ascending: false })
      .limit(2000);
    setRows((data as Row[]) ?? []);
    setLoading(false);
  }, []);
  useEffect(() => void load(), [load]);

  const addDrafts = (qs: QuestionInput[], source: DraftSource, rejected: number) => {
    setDrafts((prev) => [...prev, ...toDrafts(qs)]);
    setDraftSource(source);
    setNotice({
      ok: qs.length > 0,
      text: qs.length
        ? `Found ${qs.length} question(s)${rejected ? `; ${rejected} couldn't be used` : ""}. Review them below, then Save.`
        : "No usable questions found in that file.",
    });
  };

  const save = async () => {
    setBusy("save");
    const chosen = drafts.filter((d) => d.include && !draftProblem(d));
    const payload = chosen.map((d) => ({
      text: d.text,
      type: d.type,
      options: d.type === "mcq" ? (d.options ?? []).map((o) => o.trim()).filter(Boolean) : null,
      answer: d.answer,
      alternatives: d.alternatives,
      difficulty: d.difficulty,
      topic: d.topic,
    }));
    const { data, error } = await getBrowserSupabase().rpc("import_questions", { p_questions: payload, p_source: draftSource });
    setBusy(null);
    if (error) return setNotice({ ok: false, text: friendlyError(error.message) });
    const r = data as { inserted: number; duplicates: number; invalid: number };
    setNotice({ ok: true, text: `Saved ${r.inserted} question(s).${r.duplicates ? ` ${r.duplicates} were already in the bank.` : ""}${r.invalid ? ` ${r.invalid} were invalid.` : ""}` });
    setDrafts([]);
    void load();
  };

  const counts = useMemo(() => [1, 2, 3, 4, 5].map((d) => rows.filter((r) => r.is_enabled && r.difficulty === d).length), [rows]);
  const visible = useMemo(() => {
    const q = filter.q.trim().toLowerCase();
    return rows.filter(
      (r) =>
        (filter.difficulty === "all" || r.difficulty === Number(filter.difficulty)) &&
        (filter.enabled === "all" || r.is_enabled === (filter.enabled === "on")) &&
        (!q || r.text.toLowerCase().includes(q) || r.topic.toLowerCase().includes(q) || r.answer.toLowerCase().includes(q)),
    );
  }, [rows, filter]);

  const setEnabled = async (r: Row, on: boolean) => {
    setRows((prev) => prev.map((x) => (x.id === r.id ? { ...x, is_enabled: on } : x)));
    const { error } = await getBrowserSupabase().from("questions").update({ is_enabled: on }).eq("id", r.id);
    if (error) void load();
  };
  const remove = async (r: Row) => {
    const { error } = await getBrowserSupabase().from("questions").delete().eq("id", r.id);
    if (error) return setNotice({ ok: false, text: "That question was already used in a game, so it can't be deleted. Switch it off instead." });
    void load();
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Questions</h1>
          <p className="text-sm text-muted">
            {rows.filter((r) => r.is_enabled).length} in use · by difficulty:{" "}
            {counts.map((c, i) => (
              <span key={i} className={`mr-2 font-mono ${c < 10 ? "text-amber" : ""}`}>
                {i + 1}:{c}
              </span>
            ))}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="attention" onClick={() => setDialog("upload")} disabled={busy !== null}>
            {busy === "upload" ? "AI is reading the file…" : "Upload questions"}
          </Button>
          <Button onClick={() => setDialog("generate")} disabled={busy !== null}>
            {busy === "generate" ? "Generating…" : "Generate with AI"}
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              setDrafts((p) => [...p, blankDraft()]);
              setDraftSource("manual");
            }}
          >
            Add by hand
          </Button>
        </div>
      </div>

      {notice && (
        <p role="status" className={`rounded-xl p-3 text-sm ${notice.ok ? "bg-lime/10 text-lime" : "bg-red/10 text-red"}`}>
          {notice.text}
        </p>
      )}

      {drafts.length > 0 && <DraftEditor drafts={drafts} onChange={setDrafts} onSave={() => void save()} onDiscard={() => setDrafts([])} saving={busy === "save"} />}

      <Panel>
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-sm">
            Search
            <input value={filter.q} onChange={(e) => setFilter({ ...filter, q: e.target.value })} className="min-h-11 w-64 rounded-xl border border-line bg-bg px-3" />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Difficulty
            <select value={filter.difficulty} onChange={(e) => setFilter({ ...filter, difficulty: e.target.value })} className="min-h-11 rounded-xl border border-line bg-bg px-3">
              <option value="all">All</option>
              {[1, 2, 3, 4, 5].map((d) => (
                <option key={d}>{d}</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Status
            <select value={filter.enabled} onChange={(e) => setFilter({ ...filter, enabled: e.target.value })} className="min-h-11 rounded-xl border border-line bg-bg px-3">
              <option value="all">All</option>
              <option value="on">In use</option>
              <option value="off">Switched off</option>
            </select>
          </label>
          <p className="ml-auto text-sm text-muted">{visible.length} shown</p>
        </div>

        {loading ? (
          <p className="mt-4 text-muted">Loading questions…</p>
        ) : rows.length === 0 ? (
          <p className="mt-4 rounded-xl border border-dashed border-line p-8 text-center text-muted">
            No questions yet. Upload a question paper or generate some with AI.
          </p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="text-xs text-muted">
                <tr>
                  <th className="py-2 pr-3 font-medium">Question</th>
                  <th className="py-2 pr-3 font-medium">Answer</th>
                  <th className="py-2 pr-3 font-medium">Diff.</th>
                  <th className="py-2 pr-3 font-medium">Topic</th>
                  <th className="py-2 pr-3 font-medium">Source</th>
                  <th className="py-2 pr-3 font-medium">In use</th>
                  <th className="py-2 font-medium">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {visible.slice(0, 500).map((r) => (
                  <tr key={r.id} className={`border-t border-line align-top ${r.is_enabled ? "" : "opacity-50"}`}>
                    <td className="py-2 pr-3">
                      {r.text}
                      {r.type === "mcq" && <p className="text-xs text-muted">{(r.options ?? []).join(" · ")}</p>}
                    </td>
                    <td className="py-2 pr-3 text-lime">{r.answer}</td>
                    <td className="py-2 pr-3 font-mono">{r.difficulty}</td>
                    <td className="py-2 pr-3">{r.topic}</td>
                    <td className="py-2 pr-3 text-muted">{r.source}</td>
                    <td className="py-2 pr-3">
                      <input type="checkbox" aria-label="Use this question" checked={r.is_enabled} onChange={(e) => void setEnabled(r, e.target.checked)} />
                    </td>
                    <td className="py-2 text-right">
                      <button type="button" className="rounded-md border border-line px-2 py-1 text-xs hover:border-red" onClick={() => void remove(r)}>
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {visible.length > 500 && <p className="mt-2 text-xs text-muted">Showing the first 500. Use search or filters to narrow down.</p>}
          </div>
        )}
      </Panel>

      {dialog === "upload" && (
        <UploadDialog
          onClose={() => setDialog(null)}
          onStart={() => setBusy("upload")}
          onDone={(r, err) => {
            setBusy(null);
            if (err) setNotice({ ok: false, text: friendlyError(err) });
            else if (r) addDrafts(r.drafts, r.source, r.rejected);
          }}
        />
      )}
      {dialog === "generate" && (
        <GenerateDialog
          onClose={() => setDialog(null)}
          onStart={() => setBusy("generate")}
          onDone={(r, err) => {
            setBusy(null);
            if (err) setNotice({ ok: false, text: friendlyError(err) });
            else if (r) addDrafts(r.drafts, "ai", r.rejected);
          }}
        />
      )}
    </div>
  );
}

type Done = (r: { drafts: QuestionInput[]; rejected: number; source: DraftSource } | null, err: string | null) => void;

function UploadDialog({ onClose, onStart, onDone }: { onClose: () => void; onStart: () => void; onDone: Done }) {
  const file = useRef<HTMLInputElement>(null);
  const [difficulty, setDifficulty] = useState("auto");
  const [topic, setTopic] = useState("");
  const [picked, setPicked] = useState<File | null>(null);

  return (
    <Modal
      title="Upload questions"
      description="PDF, Word (.docx), a photo of a question paper, a text file or a CSV, up to 4 MB. The AI pulls out the questions and answers; you review them before anything is saved."
      confirmLabel="Read with AI"
      onClose={onClose}
      onConfirm={async () => {
        if (!picked) return "Choose a file first.";
        if (picked.size > MAX_UPLOAD_BYTES) return friendlyError("FILE_TOO_LARGE");
        const form = new FormData();
        form.set("file", picked);
        if (difficulty !== "auto") form.set("difficulty", difficulty);
        if (topic.trim()) form.set("topic", topic.trim());
        onStart();
        onClose();
        try {
          onDone(await postJson("/api/questions/extract", { method: "POST", body: form }), null);
        } catch (e) {
          onDone(null, e instanceof Error ? e.message : "AI_FAILED");
        }
      }}
    >
      <div className="mt-4 flex flex-col gap-3 text-sm">
        <label className="flex flex-col gap-1">
          File
          <input ref={file} type="file" accept={ACCEPT} onChange={(e) => setPicked(e.target.files?.[0] ?? null)} className="text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-cyan file:px-3 file:py-2 file:font-bold file:text-bg" />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1">
            Difficulty
            <select value={difficulty} onChange={(e) => setDifficulty(e.target.value)} className="min-h-11 rounded-xl border border-line bg-bg px-3">
              <option value="auto">Let AI decide</option>
              {[1, 2, 3, 4, 5].map((d) => (
                <option key={d} value={d}>
                  All {d}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            Topic (optional)
            <input value={topic} maxLength={60} onChange={(e) => setTopic(e.target.value)} className="min-h-11 rounded-xl border border-line bg-bg px-3" />
          </label>
        </div>
      </div>
    </Modal>
  );
}

function GenerateDialog({ onClose, onStart, onDone }: { onClose: () => void; onStart: () => void; onDone: Done }) {
  const [form, setForm] = useState({ topic: "", difficulty: 2, count: 10, type: "mcq" });
  return (
    <Modal
      title="Generate questions with AI"
      description="Gemini writes new questions. You review them before anything is saved."
      confirmLabel="Generate"
      onClose={onClose}
      onConfirm={async () => {
        if (form.topic.trim().length < 2) return "Enter a topic.";
        onStart();
        onClose();
        try {
          onDone(
            await postJson("/api/questions/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, topic: form.topic.trim() }) }),
            null,
          );
        } catch (e) {
          onDone(null, e instanceof Error ? e.message : "AI_FAILED");
        }
      }}
    >
      <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <label className="col-span-2 flex flex-col gap-1">
          Topic
          <input value={form.topic} maxLength={80} placeholder="e.g. computer networks, Indian space missions, Python" onChange={(e) => setForm({ ...form, topic: e.target.value })} className="min-h-11 rounded-xl border border-line bg-bg px-3" />
        </label>
        <label className="flex flex-col gap-1">
          Difficulty
          <select value={form.difficulty} onChange={(e) => setForm({ ...form, difficulty: Number(e.target.value) })} className="min-h-11 rounded-xl border border-line bg-bg px-3">
            {[1, 2, 3, 4, 5].map((d) => (
              <option key={d}>{d}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          How many (max 50)
          <input type="number" min={1} max={50} value={form.count} onChange={(e) => setForm({ ...form, count: Number(e.target.value) })} className="min-h-11 rounded-xl border border-line bg-bg px-3" />
        </label>
      </div>
    </Modal>
  );
}
