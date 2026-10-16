import { describe, expect, it, vi } from "vitest";
import { handleExtract, handleGenerate, type AiDeps } from "./handlers";

const good = JSON.stringify({
  questions: [{ text: "What does CPU stand for?", type: "mcq", options: ["Central Processing Unit", "Core Power Unit"], answer: "Central Processing Unit", difficulty: 1, topic: "computers" }],
});

function deps(over: Partial<AiDeps> = {}): AiDeps {
  return {
    role: async () => "admin",
    logRequest: async () => null,
    gemini: vi.fn(async () => good),
    ...over,
  };
}

const body = { topic: "Computers", difficulty: 1, count: 5, type: "mcq" };
const pdf = { name: "paper.pdf", type: "application/pdf", bytes: new Uint8Array([37, 80, 68, 70]) };

describe("handleGenerate", () => {
  it("401 when signed out, 403 for non-admins, and Gemini is never called", async () => {
    const d1 = deps({ role: async () => "none" });
    expect((await handleGenerate(body, d1)).status).toBe(401);
    const d2 = deps({ role: async () => "user" });
    expect((await handleGenerate(body, d2)).status).toBe(403);
    expect(d1.gemini).not.toHaveBeenCalled();
    expect(d2.gemini).not.toHaveBeenCalled();
  });

  it("422 on bad input, 429 when rate limited, 503 when no API key", async () => {
    expect((await handleGenerate({ topic: "" }, deps())).status).toBe(422);
    expect((await handleGenerate(body, deps({ logRequest: async () => "RATE_LIMITED" }))).status).toBe(429);
    expect((await handleGenerate(body, deps({ gemini: null }))).status).toBe(503);
  });

  it("returns validated drafts", async () => {
    const r = await handleGenerate(body, deps());
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ drafts: [{ text: "What does CPU stand for?" }], rejected: 0 });
  });

  it("502 when the model returns junk, 504 on timeout", async () => {
    expect((await handleGenerate(body, deps({ gemini: async () => "lol" }))).status).toBe(502);
    expect((await handleGenerate(body, deps({ gemini: async () => Promise.reject(new Error("AI_TIMEOUT")) }))).status).toBe(504);
  });
});

describe("handleExtract", () => {
  it("rejects non-admins before reading the file", async () => {
    const d = deps({ role: async () => "user" });
    expect((await handleExtract(pdf, {}, d)).status).toBe(403);
    expect(d.gemini).not.toHaveBeenCalled();
  });

  it("rejects missing and unsupported files", async () => {
    expect((await handleExtract(null, {}, deps())).status).toBe(422);
    expect((await handleExtract({ name: "x.exe", type: "application/x-msdownload", bytes: new Uint8Array([1]) }, {}, deps())).status).toBe(422);
  });

  it("sends PDFs to Gemini as a file part", async () => {
    const d = deps();
    const r = await handleExtract(pdf, { difficulty: "2" }, d);
    expect(r.status).toBe(200);
    const parts = (d.gemini as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(parts.some((p: { inlineData?: { mimeType: string } }) => p.inlineData?.mimeType === "application/pdf")).toBe(true);
  });

  it("sends text files as delimited text", async () => {
    const d = deps();
    await handleExtract({ name: "q.txt", type: "text/plain", bytes: new TextEncoder().encode("1. What is 2+2? Ans: 4") }, {}, d);
    const parts = (d.gemini as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(parts.some((p: { text?: string }) => p.text?.includes("<material>") && p.text.includes("What is 2+2?"))).toBe(true);
  });

  it("a CSV in our own format is imported without calling the AI", async () => {
    const d = deps();
    const csv = "text,type,options,answer,alternatives,difficulty,topic\nWhat is 2 plus 2?,one_word,,4,four,1,math\n";
    const r = await handleExtract({ name: "bank.csv", type: "text/csv", bytes: new TextEncoder().encode(csv) }, {}, d);
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ drafts: [{ answer: "4" }], source: "csv" });
    expect(d.gemini).not.toHaveBeenCalled();
  });
});
