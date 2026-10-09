/**
 * Restricts the built page to its own scripts, so injected markup
 * cannot run code that reads the OpenRouter key or acts on a Bluesky
 * login. Styles allow inline because charts set them. Any https host
 * may be fetched, since every account's data server can live anywhere.
 */
const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "connect-src https:",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'self'",
];

/** The Content-Security-Policy for the pages' meta tag. */
export function pagePolicy(): string {
  return CONTENT_SECURITY_POLICY.join("; ");
}

/**
 * Cloudflare `_headers` for the built site. As a header the policy can
 * also forbid framing, which a meta tag cannot, so no other site can
 * overlay the Unfollow buttons.
 */
export function headersFile(): string {
  return [
    "/*",
    `  Content-Security-Policy: ${[...CONTENT_SECURITY_POLICY, "frame-ancestors 'none'"].join("; ")}`,
    "  X-Content-Type-Options: nosniff",
    "  Referrer-Policy: strict-origin-when-cross-origin",
    // Bundled files are named after a hash of their content, so a
    // changed file always gets a new name and may be kept forever.
    "/assets/*",
    "  Cache-Control: public, max-age=31536000, immutable",
    "",
  ].join("\n");
}
