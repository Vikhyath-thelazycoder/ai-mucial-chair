import { NextResponse } from "next/server";
import { handleExtract } from "@/lib/ai/handlers";
import { routeDeps, sameOrigin } from "@/lib/ai/routeDeps";
import { MAX_UPLOAD_BYTES } from "@/lib/ai/upload";

export const runtime = "nodejs";
export const maxDuration = 60;

// POST multipart { file, difficulty?, topic? } → { drafts, rejected, source }. Admin only.
export async function POST(req: Request) {
  if (!sameOrigin(req)) return NextResponse.json({ code: "FORBIDDEN" }, { status: 403 });
  const length = Number(req.headers.get("content-length") ?? 0);
  if (length > MAX_UPLOAD_BYTES + 64 * 1024) return NextResponse.json({ code: "FILE_TOO_LARGE" }, { status: 413 });

  const deps = await routeDeps();
  const form = await req.formData().catch(() => null);
  const entry = form?.get("file");
  const file =
    entry && typeof entry !== "string" && entry.size <= MAX_UPLOAD_BYTES
      ? { name: entry.name, type: entry.type, bytes: new Uint8Array(await entry.arrayBuffer()) }
      : entry && typeof entry !== "string"
        ? { name: entry.name, type: entry.type, bytes: new Uint8Array(MAX_UPLOAD_BYTES + 1) }
        : null;
  const result = await handleExtract(
    file,
    { difficulty: String(form?.get("difficulty") ?? ""), topic: String(form?.get("topic") ?? "") },
    deps,
  );
  return NextResponse.json(result.body, { status: result.status });
}
