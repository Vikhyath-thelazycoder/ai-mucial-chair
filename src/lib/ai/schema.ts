import { questionSchema, type QuestionInput } from "@/lib/questions/csv";

export const MAX_DRAFTS = 100;

/** JSON Schema Gemini must answer in (structured output). */
export const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    questions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          text: { type: "string", description: "The question, at most 200 characters" },
          type: { type: "string", enum: ["mcq", "one_word"] },
          options: { type: "array", items: { type: "string" }, description: "MCQ only: 2-6 options" },
          answer: { type: "string", description: "MCQ: exactly one of the options. One word: the word or number" },
          alternatives: { type: "array", items: { type: "string" }, description: "One word only: other accepted spellings" },
          difficulty: { type: "integer", minimum: 1, maximum: 5 },
          topic: { type: "string" },
        },
        required: ["text", "type", "answer", "difficulty", "topic"],
      },
    },
  },
  required: ["questions"],
} as const;

const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
const strList = (v: unknown) => (Array.isArray(v) ? v.map(str).filter(Boolean) : []);

/** Repairs the slips models commonly make, then validates with the same schema as CSV import. */
function coerce(raw: unknown): QuestionInput | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const options = strList(r.options);
  const type = r.type === "one_word" || r.type === "mcq" ? r.type : options.length ? "mcq" : "one_word";
  let answer = str(r.answer);
  if (type === "mcq") {
    const letter = /^[A-Fa-f]$/.test(answer) ? options[answer.toUpperCase().charCodeAt(0) - 65] : undefined;
    const sameCase = options.find((o) => o.toLowerCase() === answer.toLowerCase());
    if (!options.includes(answer)) answer = sameCase ?? letter ?? answer;
  }
  const difficulty = Math.min(5, Math.max(1, Math.round(Number(r.difficulty) || 3)));
  const parsed = questionSchema.safeParse({
    text: str(r.text).replace(/\s+/g, " "),
    type,
    options: type === "mcq" ? options : null,
    answer,
    alternatives: type === "one_word" ? strList(r.alternatives) : [],
    difficulty,
    topic: str(r.topic).slice(0, 60) || "general",
  });
  return parsed.success ? parsed.data : null;
}

/**
 * Parses and validates model output (SECURITY.md T13: LLM output is untrusted).
 * Throws AI_BAD_OUTPUT when it isn't the expected JSON at all.
 */
export function validateDrafts(text: string): { drafts: QuestionInput[]; rejected: number } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("AI_BAD_OUTPUT");
  }
  const items = Array.isArray(parsed) ? parsed : (parsed as { questions?: unknown })?.questions;
  if (!Array.isArray(items)) throw new Error("AI_BAD_OUTPUT");

  const seen = new Set<string>();
  const drafts: QuestionInput[] = [];
  let rejected = 0;
  for (const item of items) {
    const q = coerce(item);
    if (!q) {
      rejected++;
      continue;
    }
    const key = q.text.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    if (drafts.length < MAX_DRAFTS) drafts.push(q);
  }
  return { drafts, rejected };
}
