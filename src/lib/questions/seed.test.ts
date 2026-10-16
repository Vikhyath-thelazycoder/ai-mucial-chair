import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseQuestionsCsv } from "./csv";

const csv = readFileSync(join(process.cwd(), "supabase/seed/questions.csv"), "utf8");

describe("seed question bank", () => {
  const { questions, errors } = parseQuestionsCsv(csv);

  it("has no invalid rows", () => {
    expect(errors).toEqual([]);
  });

  it("has at least 150 questions", () => {
    expect(questions.length).toBeGreaterThanOrEqual(150);
  });

  it("covers every difficulty with at least 20 questions", () => {
    for (const d of [1, 2, 3, 4, 5]) {
      expect(questions.filter((q) => q.difficulty === d).length, `difficulty ${d}`).toBeGreaterThanOrEqual(20);
    }
  });

  it("has no duplicate question text", () => {
    const texts = questions.map((q) => q.text.toLowerCase());
    expect(new Set(texts).size).toBe(texts.length);
  });

  it("mixes multiple choice and one-word questions", () => {
    expect(questions.some((q) => q.type === "mcq")).toBe(true);
    expect(questions.some((q) => q.type === "one_word")).toBe(true);
  });
});

describe("parseQuestionsCsv", () => {
  const header = "text,type,options,answer,alternatives,difficulty,topic";

  it("reports bad rows with their CSV row number and keeps good ones", () => {
    const { questions, errors } = parseQuestionsCsv(
      [
        header,
        "Valid question here?,mcq,a|b|c,b,,2,x",
        "MCQ whose answer is missing?,mcq,a|b,z,,2,x",
        "Bad difficulty question?,one_word,,yes,,9,x",
        "One word with options?,one_word,a|b,a,,1,x",
      ].join("\n"),
    );
    expect(questions).toHaveLength(1);
    expect(errors.map((e) => e.row)).toEqual([3, 4, 5]);
  });

  it("handles quoted fields containing commas", () => {
    const { questions } = parseQuestionsCsv(`${header}\n"Which, of these, is right?",mcq,"x, y|z",z,,1,x`);
    expect(questions[0].text).toBe("Which, of these, is right?");
    expect(questions[0].options).toEqual(["x, y", "z"]);
  });
});
