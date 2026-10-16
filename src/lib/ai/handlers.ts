// Request handling for the AI question routes, with its dependencies injected so it can be tested
// without Next.js, Supabase or Gemini. The route files only wire real dependencies in.
import { parseQuestionsCsv } from "@/lib/questions/csv";
import { extractPrompt, generateInputSchema, generatePrompt, wrapMaterial } from "./prompt";
import { validateDrafts } from "./schema";
import { IMAGE_MIME, classifyUpload, extensionOf } from "./upload";

export type GeminiPart = { text: string } | { inlineData: { mimeType: string; data: string } };

export type AiDeps = {
  role: () => Promise<"none" | "user" | "admin">;
  /** Records the request; returns an error code such as RATE_LIMITED, or null. */
  logRequest: () => Promise<string | null>;
  /** null when GEMINI_API_KEY isn't configured. */
  gemini: ((parts: GeminiPart[]) => Promise<string>) | null;
  docxToText?: (bytes: Uint8Array) => Promise<string>;
};

export type Result = { status: number; body: Record<string, unknown> };

const fail = (status: number, code: string): Result => ({ status, body: { code } });
const MAX_TEXT_CHARS = 60_000;

async function guard(deps: AiDeps): Promise<Result | null> {
  const role = await deps.role();
  if (role === "none") return fail(401, "NOT_AUTHENTICATED");
  if (role !== "admin") return fail(403, "NOT_ADMIN");
  return null;
}

async function ask(deps: AiDeps, parts: GeminiPart[]): Promise<Result> {
  if (!deps.gemini) return fail(503, "AI_NOT_CONFIGURED");
  const limited = await deps.logRequest();
  if (limited) return fail(limited === "RATE_LIMITED" ? 429 : 403, limited);
  try {
    const { drafts, rejected } = validateDrafts(await deps.gemini(parts));
    return { status: 200, body: { drafts, rejected, source: "ai" } };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg === "AI_BAD_OUTPUT") return fail(502, "AI_BAD_OUTPUT");
    if (msg === "AI_TIMEOUT") return fail(504, "AI_TIMEOUT");
    return fail(502, "AI_FAILED");
  }
}

export async function handleGenerate(body: unknown, deps: AiDeps): Promise<Result> {
  const denied = await guard(deps);
  if (denied) return denied;
  const input = generateInputSchema.safeParse(body);
  if (!input.success) return fail(422, "VALIDATION");
  return ask(deps, [{ text: generatePrompt(input.data) }]);
}

export async function handleExtract(
  file: { name: string; type: string; bytes: Uint8Array } | null,
  fields: { difficulty?: string; topic?: string },
  deps: AiDeps,
): Promise<Result> {
  const denied = await guard(deps);
  if (denied) return denied;
  if (!file) return fail(422, "NO_FILE");
  const kind = classifyUpload({ name: file.name, type: file.type, size: file.bytes.byteLength });
  if (!kind.ok) return fail(422, kind.code);

  const difficulty = Number(fields.difficulty);
  const instructions = extractPrompt({
    difficulty: Number.isInteger(difficulty) && difficulty >= 1 && difficulty <= 5 ? difficulty : null,
    topic: (fields.topic ?? "").trim(),
  });

  switch (kind.kind) {
    case "csv": {
      const text = new TextDecoder().decode(file.bytes);
      // Our own CSV format imports directly; anything else is read by the AI.
      const parsed = parseQuestionsCsv(text);
      if (parsed.questions.length > 0 && /^\s*text\s*,\s*type/i.test(text)) {
        return { status: 200, body: { drafts: parsed.questions, rejected: parsed.errors.length, source: "csv" } };
      }
      return ask(deps, [{ text: instructions }, { text: wrapMaterial(text.slice(0, MAX_TEXT_CHARS)) }]);
    }
    case "text":
      return ask(deps, [{ text: instructions }, { text: wrapMaterial(new TextDecoder().decode(file.bytes).slice(0, MAX_TEXT_CHARS)) }]);
    case "docx": {
      if (!deps.docxToText) return fail(422, "UNSUPPORTED_FILE");
      const text = await deps.docxToText(file.bytes).catch(() => "");
      if (!text.trim()) return fail(422, "UNREADABLE_FILE");
      return ask(deps, [{ text: instructions }, { text: wrapMaterial(text.slice(0, MAX_TEXT_CHARS)) }]);
    }
    case "pdf":
    case "image": {
      const mimeType = kind.kind === "pdf" ? "application/pdf" : IMAGE_MIME[extensionOf(file.name)];
      const data = Buffer.from(file.bytes).toString("base64");
      return ask(deps, [{ text: instructions }, { inlineData: { mimeType, data } }]);
    }
  }
}
