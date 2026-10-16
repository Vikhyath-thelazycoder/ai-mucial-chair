// Chair QR codes encode https://<site>/c/<chairId>?k=<secret> (D-005).

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SECRET = /^[0-9a-f]{48}$/;

export function chairUrl(siteUrl: string, chairId: string, secret: string): string {
  return `${siteUrl.replace(/\/$/, "")}/c/${chairId}?k=${secret}`;
}

/** Returns the chair from a scanned string, or null for anything that isn't one of our chair QRs. */
export function parseChairQr(text: string, allowedHosts: readonly string[]): { chairId: string; secret: string } | null {
  let url: URL;
  try {
    url = new URL(text.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  if (!allowedHosts.includes(url.host)) return null;
  const match = /^\/c\/([^/]+)$/.exec(url.pathname);
  const secret = url.searchParams.get("k") ?? "";
  if (!match || !UUID.test(match[1]) || !SECRET.test(secret)) return null;
  return { chairId: match[1].toLowerCase(), secret };
}
