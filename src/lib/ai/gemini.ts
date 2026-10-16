import "server-only";

import { GoogleGenAI } from "@google/genai";
import type { GeminiPart } from "./handlers";
import { SYSTEM_INSTRUCTION } from "./prompt";
import { RESPONSE_SCHEMA } from "./schema";

// The key lives only in server env (never NEXT_PUBLIC_). GEMINI_MODEL can pin a specific model;
// the default alias always points at Google's current Flash model.
const DEFAULT_MODEL = "gemini-flash-latest";
const TIMEOUT_MS = 50_000;

export function geminiConfigured(): boolean {
  return Boolean(process.env.GEMINI_API_KEY);
}

export async function askGemini(parts: GeminiPart[]): Promise<string> {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await ai.models.generateContent({
      model: process.env.GEMINI_MODEL || DEFAULT_MODEL,
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
    if (controller.signal.aborted) throw new Error("AI_TIMEOUT");
    // Log the category only: never the prompt (may contain uploaded material) or the key.
    console.error("gemini request failed:", e instanceof Error ? e.name : "unknown");
    throw new Error("AI_FAILED");
  } finally {
    clearTimeout(timer);
  }
}
