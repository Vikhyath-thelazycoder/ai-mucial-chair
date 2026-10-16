// Gate: the /play page must not load three.js up front (DESIGN.md › Motion: no 3D on the scanner or
// question screens). The 3D ring is a lazily loaded chunk that only low-risk screens request.
// Run after `npm run build`.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const dist = process.env.NEXT_DIST_DIR || ".next";
const manifestPath = join(dist, "app-build-manifest.json");
if (!existsSync(manifestPath)) {
  console.error(`No ${manifestPath}. Run npm run build first.`);
  process.exit(1);
}

const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const chunks = manifest.pages["/play/page"];
if (!chunks) {
  console.error("/play/page not found in the build manifest");
  process.exit(1);
}

const markers = ["WebGLRenderer", "WebGLRenderTarget"];
const offenders = chunks.filter((file) => {
  const code = readFileSync(join(dist, file), "utf8");
  return markers.some((m) => code.includes(m));
});

if (offenders.length) {
  console.error(`three.js is in the initial /play bundle: ${offenders.join(", ")}`);
  process.exit(1);
}
const bytes = chunks.reduce((n, f) => n + readFileSync(join(dist, f)).length, 0);
console.log(`/play initial JS: ${chunks.length} files, ${(bytes / 1024).toFixed(0)} KB uncompressed, no three.js`);
