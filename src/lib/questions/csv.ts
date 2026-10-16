import Papa from "papaparse";
import { z } from "zod";

// One validated question row, matching the questions table (TRD › Database) and its CHECK constraints.
export const questionSchema = z
  .object({
    text: z.string().trim().min(5).max(300),
    type: z.enum(["mcq", "one_word"]),
    options: z.array(z.string().trim().min(1).max(60)).nullable(),
    answer: z.string().trim().min(1).max(80),
    alternatives: z.array(z.string().trim().min(1).max(80)),
    difficulty: z.number().int().min(1).max(5),
    topic: z.string().trim().min(1).max(60),
  })
  .superRefine((q, ctx) => {
    if (q.type === "mcq") {
      if (!q.options || q.options.length < 2 || q.options.length > 6) {
        ctx.addIssue({ code: "custom", path: ["options"], message: "MCQ needs 2 to 6 options" });
      } else if (!q.options.includes(q.answer)) {
        ctx.addIssue({ code: "custom", path: ["answer"], message: "MCQ answer must be one of the options" });
      } else if (new Set(q.options).size !== q.options.length) {
        ctx.addIssue({ code: "custom", path: ["options"], message: "MCQ options must be unique" });
      }
    } else if (q.options) {
      ctx.addIssue({ code: "custom", path: ["options"], message: "One-word questions have no options" });
    }
  });

export type QuestionInput = z.infer<typeof questionSchema>;
export type CsvRowError = { row: number; message: string };

const list = (v: string | undefined) =>
  (v ?? "")
    .split("|")
    .map((s) => s.trim())
    .filter(Boolean);

/**
 * Parses the question CSV (columns: text,type,options,answer,alternatives,difficulty,topic;
 * options and alternatives are pipe-separated). Invalid rows are reported with their CSV row number.
 */
export function parseQuestionsCsv(csv: string): { questions: QuestionInput[]; errors: CsvRowError[] } {
  const parsed = Papa.parse<Record<string, string>>(csv.trim(), { header: true, skipEmptyLines: true });
  const questions: QuestionInput[] = [];
  const errors: CsvRowError[] = parsed.errors.map((e) => ({ row: (e.row ?? 0) + 2, message: e.message }));

  parsed.data.forEach((raw, i) => {
    const type = raw.type?.trim();
    const options = list(raw.options);
    const candidate = {
      text: raw.text ?? "",
      type,
      // Keep stray options on one-word rows so validation reports them instead of silently dropping them.
      options: type === "mcq" || options.length ? options : null,
      answer: raw.answer ?? "",
      alternatives: list(raw.alternatives),
      difficulty: Number(raw.difficulty),
      topic: raw.topic?.trim() || "general",
    };
    const result = questionSchema.safeParse(candidate);
    if (result.success) questions.push(result.data);
    else errors.push({ row: i + 2, message: result.error.issues.map((x) => `${x.path.join(".")}: ${x.message}`).join("; ") });
  });

  return { questions, errors };
}
