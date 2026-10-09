import { execSync } from "node:child_process";
import { appendFileSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { defineConfig, type Plugin } from "vitest/config";
import { clientMetadataFor } from "./src/auth/client-metadata.ts";
import { headersFile, pagePolicy } from "./src/hosting.ts";
import { UNKNOWN_VERSION } from "./src/version.ts";

/**
 * The build's version as `git describe` gives it: the latest tag if any,
 * the commit, and `-dirty` for uncommitted changes. Cloudflare's build
 * provides the commit if git cannot describe it.
 */
function buildVersion(): string {
  if (process.env.WORKERS_CI === "1") fetchTags();
  try {
    return execSync("git describe --tags --always --dirty --abbrev=7", {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return process.env.WORKERS_CI_COMMIT_SHA?.slice(0, 7) ?? UNKNOWN_VERSION;
  }
}

/**
 * Cloudflare builds from a shallow clone without tags, where `git
 * describe` can only name the commit. Fetching the history and tags
 * lets it name the release too. Best effort: on failure the commit is
 * still shown.
 */
function fetchTags(): void {
  const run = (command: string) =>
    execSync(command, { stdio: "ignore", timeout: 60_000 });
  try {
    run("git fetch --quiet --tags --unshallow");
  } catch {
    try {
      run("git fetch --quiet --tags");
    } catch {
      // Offline or no remote: describe falls back to the commit.
    }
  }
}

/** Public address of the deployed app; Bluesky login is bound to it. */
const PUBLIC_URL =
  process.env.SKYDEX_PUBLIC_URL ?? "https://skydex.avanian.net/";

/**
 * Adds the Content-Security-Policy to built pages. Dev builds skip it:
 * the dev server needs inline scripts and a websocket.
 */
function contentSecurityPolicy(): Plugin {
  return {
    name: "content-security-policy",
    apply: "build",
    transformIndexHtml: () => [
      {
        tag: "meta",
        attrs: {
          "http-equiv": "Content-Security-Policy",
          content: pagePolicy(),
        },
        injectTo: "head-prepend",
      },
    ],
  };
}

/**
 * Files the static host needs next to the pages: the OAuth client
 * metadata Bluesky fetches to identify the app, and Cloudflare
 * response headers.
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
        source: headersFile(),
      });
    },
  };
}

/** Where the build lists the licences of the code it bundles. */
const LICENSES_FILE = "third-party-licenses.txt";

/**
 * Adds the licences of code copied into `src/vendor` to the file Vite
 * writes for bundled npm packages, which cannot see them.
 */
function vendoredLicenses(): Plugin {
  return {
    name: "vendored-licenses",
    apply: "build",
    writeBundle({ dir = "dist" }) {
      const vendor = new URL("src/vendor/", import.meta.url);
      const sections = readdirSync(vendor).map((name) => {
        const source = new URL(`${name}/`, vendor);
        const title = readFileSync(new URL("README.md", source), "utf8")
          .split("\n")[0]
          ?.replace(/^# /, "");
        const licence = readFileSync(new URL("LICENSE", source), "utf8");
        return `\n## ${title}\n\n${licence.trim()}\n`;
      });
      appendFileSync(join(dir, LICENSES_FILE), sections.join(""));
    },
  };
}

export default defineConfig({
  base: "./",
  plugins: [contentSecurityPolicy(), hostingFiles(), vendoredLicenses()],
  define: { __SKYDEX_VERSION__: JSON.stringify(buildVersion()) },
  server: { host: "127.0.0.1" },
  preview: { host: "127.0.0.1" },
  build: {
    license: { fileName: LICENSES_FILE },
    rollupOptions: {
      input: {
        main: "index.html",
        callback: "callback/index.html",
        privacy: "privacy/index.html",
        guide: "guide/index.html",
      },
    },
  },
  test: {
    include: ["test/**/*.test.ts"],
    exclude: ["test/live/**"],
    coverage: {
      include: ["src/**/*.ts"],
      exclude: ["src/vendor/**"],
      reporter: ["text"],
    },
  },
});
