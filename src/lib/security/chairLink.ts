/**
 * A chair QR opened by a normal camera app lands on /c/<id>?k=<secret>. Redirect to the bare path so the
 * secret doesn't stay in the page payload or the phone's history (SECURITY.md T2, T5).
 * Returns the URL to redirect to, or null when nothing needs stripping.
 */
export function stripChairSecret(url: URL): URL | null {
  if (!url.pathname.startsWith("/c/") || !url.search) return null;
  const clean = new URL(url);
  clean.search = "";
  return clean;
}
