import { defineConfig, type Plugin } from "vitest/config";
import { clientMetadataFor } from "./src/auth/client-metadata.ts";

/** Public address of the deployed app; Bluesky login is bound to it. */
const PUBLIC_URL =
  process.env.SKYDEX_PUBLIC_URL ?? "https://skydex.avanian.net/";

/**
 * Restricts the built page to its own scripts, so injected markup
 * cannot run code that reads the OpenRouter key or acts on a Bluesky
 * login. Styles allow inline because charts set them. Any https host
 * may be fetched, since every account's data server can live anywhere.
 * Dev builds skip it: the dev server needs inline scripts and a
 * websocket.
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

function contentSecurityPolicy(): Plugin {
  return {
    name: "content-security-policy",
    apply: "build",
    transformIndexHtml: () => [
      {
        tag: "meta",
        attrs: {
          "http-equiv": "Content-Security-Policy",
          content: CONTENT_SECURITY_POLICY.join("; "),
        },
        injectTo: "head-prepend",
      },
    ],
  };
}

/**
 * Files the static host needs next to the pages: the OAuth client
 * metadata Bluesky fetches to identify the app, and Cloudflare
 * response headers. As a header the policy can also forbid framing,
 * which a meta tag cannot, so no other site can overlay the Unfollow
 * buttons.
 */
function hostingFiles(): Plugin {
  return {
    name: "hosting-files",
    apply: "build",
    generateBundle() {
      this.emitFile({
        type: "asset",
        fileName: "client-metadata.json",
        source:
          JSON.stringify(clientMetadataFor(new URL(PUBLIC_URL)), null, 2) +
          "\n",
      });
      this.emitFile({
        type: "asset",
        fileName: "_headers",
        source: [
          "/*",
          `  Content-Security-Policy: ${[...CONTENT_SECURITY_POLICY, "frame-ancestors 'none'"].join("; ")}`,
          "  X-Content-Type-Options: nosniff",
          "  Referrer-Policy: strict-origin-when-cross-origin",
          "",
        ].join("\n"),
      });
    },
  };
}

export default defineConfig({
  base: "./",
  plugins: [contentSecurityPolicy(), hostingFiles()],
  server: { host: "127.0.0.1" },
  preview: { host: "127.0.0.1" },
  build: {
    rollupOptions: {
      input: { main: "index.html", callback: "callback/index.html" },
    },
  },
  test: {
    include: ["test/**/*.test.ts"],
    exclude: ["test/live/**"],
  },
});
