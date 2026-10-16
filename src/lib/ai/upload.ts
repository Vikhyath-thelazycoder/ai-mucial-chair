// Uploaded question files (T-5.1). Vercel caps request bodies at ~4.5 MB, so files are limited to 4 MB.
export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;

export type UploadKind = "pdf" | "docx" | "image" | "text" | "csv";

const BY_EXTENSION: Record<string, UploadKind> = {
  pdf: "pdf",
  docx: "docx",
  png: "image",
  jpg: "image",
  jpeg: "image",
  webp: "image",
  txt: "text",
  md: "text",
  csv: "csv",
};

export const ACCEPT = ".pdf,.docx,.png,.jpg,.jpeg,.webp,.txt,.md,.csv";

export const IMAGE_MIME: Record<string, string> = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp" };

export function extensionOf(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot === -1 ? "" : name.slice(dot + 1).toLowerCase();
}

/** Decides by extension (the browser's MIME type is advisory). SVG/HTML are refused: they can carry script. */
export function classifyUpload(f: { name: string; type: string; size: number }): { ok: true; kind: UploadKind } | { ok: false; code: string } {
  const kind = BY_EXTENSION[extensionOf(f.name)];
  if (!kind) return { ok: false, code: "UNSUPPORTED_FILE" };
  if (f.size <= 0) return { ok: false, code: "EMPTY_FILE" };
  if (f.size > MAX_UPLOAD_BYTES) return { ok: false, code: "FILE_TOO_LARGE" };
  return { ok: true, kind };
}
