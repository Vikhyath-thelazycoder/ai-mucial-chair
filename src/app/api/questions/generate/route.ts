import { NextResponse } from "next/server";
import { handleGenerate } from "@/lib/ai/handlers";
import { routeDeps, sameOrigin } from "@/lib/ai/routeDeps";

export const runtime = "nodejs";
export const maxDuration = 60;

// POST { topic, difficulty, count, type } → { drafts, rejected }. Admin only; drafts are reviewed before saving.
export async function POST(req: Request) {
  if (!sameOrigin(req)) return NextResponse.json({ code: "FORBIDDEN" }, { status: 403 });
  const body = await req.json().catch(() => null);
  const result = await handleGenerate(body, await routeDeps());
  return NextResponse.json(result.body, { status: result.status });
}
