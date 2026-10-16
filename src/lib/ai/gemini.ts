import "server-only";

import { GoogleGenAI } from "@google/genai";
import type { GeminiPart } from "./handlers";
import { SYSTEM_INSTRUCTION } from "./prompt";
import { RESPONSE_SCHEMA } from "./schema";

// The key lives only in server env (never NEXT_PUBLIC_). Models are tried in order: GEMINI_MODEL if set, then a
// chain of Flash models. Google retires versions (404), throttles busy ones (503) and caps free-tier quota per
// model (429), so one model being unavailable must not take question authoring down at the event.
export const MODEL_CHAIN = ["gemini-flash-latest", "gemini-3-flash-preview", "gemini-flash-lite-latest"];
const TIMEOUT_MS = 55_000;

export function geminiConfigured(): boolean {
  return Boolean(process.env.GEMINI_API_KEY);
}

const statusOf = (e: unknown) => (e as { status?: number })?.status ?? 0;
/** Worth trying another model: retired/unknown (404), over quota (429), overloaded (5xx). */
export const tryNextModel = (status: number) => status === 404 || status === 429 || (status >= 500 && status <= 504);

export function modelOrder(configured: string | undefined): string[] {
  return [...new Set([configured?.trim(), ...MODEL_CHAIN].filter((m): m is string => Boolean(m)))];
}

export async function askGemini(parts: GeminiPart[]): Promise<string> {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let last: unknown;
  try {
    for (const model of modelOrder(process.env.GEMINI_MODEL)) {
      try {
        const res = await ai.models.generateContent({
          model,
          contents: [{ role: "user", parts }],
          config: {
            systemInstruction: SYSTEM_INSTRUCTION,
            responseMimeType: "application/json",
            responseJsonSchema: RESPONSE_SCHEMA,
            temperature: 0.4,
            abortSignal: controller.signal,
          },
        });
        return res.text ?? "";
      } catch (e) {
        last = e;
        if (controller.signal.aborted || !tryNextModel(statusOf(e))) break;
        console.warn(`gemini model ${model} unavailable (${statusOf(e)}), trying the next one`);
      }
    }
    if (controller.signal.aborted) throw new Error("AI_TIMEOUT");
    // Log the category and HTTP status only: never the prompt (may contain uploaded material) or the key.
    console.error("gemini request failed:", last instanceof Error ? last.name : "unknown", statusOf(last));
    throw new Error(statusOf(last) === 429 ? "AI_QUOTA" : "AI_FAILED");
  } finally {
    clearTimeout(timer);
  }
}
