import { describe, expect, it } from "vitest";
import { validateDrafts } from "./schema";

const mcq = { text: "Which data structure is LIFO?", type: "mcq", options: ["Queue", "Stack", "Tree", "Graph"], answer: "Stack", difficulty: 2, topic: "dsa" };

describe("validateDrafts (Gemini output is untrusted)", () => {
  it("accepts the documented shape", () => {
    const r = validateDrafts(JSON.stringify({ questions: [mcq] }));
    expect(r.drafts).toHaveLength(1);
    expect(r.rejected).toBe(0);
  });

  it("rejects text that isn't JSON or isn't the right shape", () => {
    expect(() => validateDrafts("not json")).toThrow("AI_BAD_OUTPUT");
    expect(() => validateDrafts(JSON.stringify({ nope: 1 }))).toThrow("AI_BAD_OUTPUT");
  });

  it("fixes common model slips: option letter as the answer, case differences, out-of-range difficulty", () => {
    const r = validateDrafts(
      JSON.stringify({
        questions: [
          { ...mcq, answer: "B" },
          { ...mcq, text: "Which is FIFO?", answer: "queue" },
          { ...mcq, text: "Hardest one?", difficulty: 9 },
        ],
      }),
    );
    expect(r.drafts.map((d) => d.answer)).toEqual(["Stack", "Queue", "Stack"]);
    expect(r.drafts[2].difficulty).toBe(5);
  });

  it("drops invalid items and counts them, keeping the rest", () => {
    const r = validateDrafts(
      JSON.stringify({
        questions: [
          mcq,
          { ...mcq, text: "MCQ whose answer is nowhere?", answer: "Heap" },
          { text: "", type: "one_word", answer: "x", difficulty: 1, topic: "t" },
          { text: "One word with options?", type: "one_word", options: ["a"], answer: "a", difficulty: 1, topic: "t" },
          "garbage",
        ],
      }),
    );
    expect(r.drafts).toHaveLength(2); // the one-word item keeps its answer and loses the stray options
    expect(r.rejected).toBe(3);
  });

  it("removes duplicates within one batch", () => {
    const r = validateDrafts(JSON.stringify({ questions: [mcq, { ...mcq, text: "  which data structure is LIFO? " }] }));
    expect(r.drafts).toHaveLength(1);
  });

  it("caps a batch at 100 questions", () => {
    const many = Array.from({ length: 150 }, (_, i) => ({ ...mcq, text: `Question number ${i}?` }));
    expect(validateDrafts(JSON.stringify({ questions: many })).drafts).toHaveLength(100);
  });

  it("never lets markup through as anything but text (rendered escaped by React)", () => {
    const r = validateDrafts(JSON.stringify({ questions: [{ ...mcq, text: "<img src=x onerror=alert(1)> what?" }] }));
    expect(r.drafts[0].text).toBe("<img src=x onerror=alert(1)> what?");
  });
});
