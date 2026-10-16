// Content-Security-Policy and static security headers (SECURITY.md › Security decisions).

export function buildCsp({
  nonce,
  supabaseUrl,
  dev,
}: {
  nonce: string;
  supabaseUrl: string;
  dev: boolean;
}): string {
  const supabase = new URL(supabaseUrl);
  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    "script-src": [
      "'self'",
      `'nonce-${nonce}'`,
      "'strict-dynamic'",
      "https://sdk.scdn.co",
      ...(dev ? ["'unsafe-eval'"] : []),
    ],
    // React/motion set style attributes, which cannot carry a nonce.
    "style-src": ["'self'", "'unsafe-inline'"],
    "img-src": ["'self'", "data:", "blob:", "https://i.scdn.co"],
    "font-src": ["'self'"],
    "connect-src": [
      "'self'",
      `https://${supabase.host}`,
      `wss://${supabase.host}`,
      "https://api.spotify.com",
      "https://accounts.spotify.com",
      "https://*.spotify.com",
      ...(dev ? ["ws:"] : []),
    ],
    "media-src": ["'self'", "blob:"],
    "worker-src": ["'self'", "blob:"],
    "frame-src": ["https://sdk.scdn.co"],
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'"],
    "frame-ancestors": ["'none'"],
  };
  return Object.entries(directives)
    .map(([name, values]) => `${name} ${values.join(" ")}`)
    .join("; ");
}

export function staticSecurityHeaders(): { key: string; value: string }[] {
  return [
    { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    { key: "X-Frame-Options", value: "DENY" },
    {
      key: "Permissions-Policy",
      value: "camera=(self), microphone=(), geolocation=(), payment=(), usb=()",
    },
  ];
}
