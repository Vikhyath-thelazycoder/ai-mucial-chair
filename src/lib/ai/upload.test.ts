import { describe, expect, it } from "vitest";
import { MAX_UPLOAD_BYTES, classifyUpload } from "./upload";

describe("classifyUpload", () => {
  it.each([
    ["paper.pdf", "application/pdf", "pdf"],
    ["paper.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "docx"],
    ["photo.JPG", "image/jpeg", "image"],
    ["shot.png", "image/png", "image"],
    ["shot.webp", "image/webp", "image"],
    ["notes.txt", "text/plain", "text"],
    ["notes.md", "", "text"],
    ["bank.csv", "text/csv", "csv"],
  ])("%s → %s", (name, type, kind) => {
    expect(classifyUpload({ name, type, size: 1000 })).toEqual({ ok: true, kind });
  });

  it.each([
    ["virus.exe", "application/octet-stream"],
    ["page.html", "text/html"],
    ["vector.svg", "image/svg+xml"],
    ["old.doc", "application/msword"],
    ["archive.zip", "application/zip"],
  ])("rejects %s", (name, type) => {
    expect(classifyUpload({ name, type, size: 1000 })).toEqual({ ok: false, code: "UNSUPPORTED_FILE" });
  });

  it("rejects empty and oversized files", () => {
    expect(classifyUpload({ name: "a.pdf", type: "application/pdf", size: 0 })).toEqual({ ok: false, code: "EMPTY_FILE" });
    expect(classifyUpload({ name: "a.pdf", type: "application/pdf", size: MAX_UPLOAD_BYTES + 1 })).toEqual({ ok: false, code: "FILE_TOO_LARGE" });
  });
});
