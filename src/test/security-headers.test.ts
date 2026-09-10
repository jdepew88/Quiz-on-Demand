import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Guards the production security headers in `public/_headers`.
 *
 * Cloudflare Workers Static Assets parses that file and applies it to every response.
 * These tests keep it from drifting: a loosened CSP, a second overlapping rule (which
 * Cloudflare would merge by comma-joining the repeated headers), or an inline script in
 * `index.html` that the policy would silently block in production — while `npm run dev`,
 * which does not apply `_headers`, kept working.
 */

// Vitest runs with the project root as the working directory.
const HEADERS_TEXT = readFileSync(resolve(process.cwd(), "public", "_headers"), "utf8");
const INDEX_HTML = readFileSync(resolve(process.cwd(), "index.html"), "utf8");

interface Rule {
  path: string;
  headers: Map<string, string>;
}

/** Minimal `_headers` parser: unindented line = URL pattern, indented line = header. */
function parseHeadersFile(text: string): Rule[] {
  const rules: Rule[] = [];
  for (const line of text.split(/\r?\n/)) {
    if (line.trim() === "" || line.trimStart().startsWith("#")) continue;

    if (!/^\s/.test(line)) {
      rules.push({ path: line.trim(), headers: new Map() });
      continue;
    }

    const current = rules.at(-1);
    if (!current) throw new Error(`Header line appears before any URL pattern: ${line}`);
    const colon = line.indexOf(":");
    if (colon === -1) throw new Error(`Header line has no colon: ${line}`);
    current.headers.set(line.slice(0, colon).trim().toLowerCase(), line.slice(colon + 1).trim());
  }
  return rules;
}

const RULES = parseHeadersFile(HEADERS_TEXT);
const HEADERS = RULES[0]?.headers ?? new Map<string, string>();

/** CSP directive name -> source list. */
function parseCsp(policy: string): Map<string, string[]> {
  return new Map(
    policy
      .split(";")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const [name = "", ...sources] = part.split(/\s+/);
        return [name.toLowerCase(), sources] as const;
      }),
  );
}

const CSP = parseCsp(HEADERS.get("content-security-policy") ?? "");

describe("public/_headers structure", () => {
  it("declares exactly one catch-all rule", () => {
    expect(RULES.map((rule) => rule.path)).toEqual(["/*"]);
  });

  it("stays within Cloudflare's limits (100 rules, 2,000 characters per line)", () => {
    expect(RULES.length).toBeLessThanOrEqual(100);
    for (const line of HEADERS_TEXT.split(/\r?\n/)) {
      expect(line.length, `line too long: ${line.slice(0, 60)}…`).toBeLessThanOrEqual(2000);
    }
  });
});

describe("required headers", () => {
  it.each([
    ["x-content-type-options", "nosniff"],
    ["x-frame-options", "DENY"],
    ["referrer-policy", "no-referrer"],
    ["cross-origin-opener-policy", "same-origin"],
    ["cross-origin-resource-policy", "same-origin"],
  ])("sets %s: %s", (name, value) => {
    expect(HEADERS.get(name)).toBe(value);
  });

  it("sets Strict-Transport-Security for this hostname only (max-age, no includeSubDomains or preload — see README)", () => {
    expect(HEADERS.get("strict-transport-security")).toBe("max-age=31536000");
  });

  it("does not set the obsolete X-XSS-Protection header", () => {
    expect(HEADERS.has("x-xss-protection")).toBe(false);
  });
});

describe("Content-Security-Policy", () => {
  it("is present", () => {
    expect(HEADERS.get("content-security-policy")).toBeTruthy();
  });

  it("denies everything by default", () => {
    expect(CSP.get("default-src")).toEqual(["'none'"]);
  });

  it.each(["script-src", "style-src", "img-src", "connect-src"])(
    "allows only the app's own origin for %s",
    (directive) => {
      expect(CSP.get(directive)).toEqual(["'self'"]);
    },
  );

  it.each([
    ["frame-ancestors", "clickjacking: nothing may frame the app"],
    ["base-uri", "no <base> tag may be injected"],
    ["form-action", "the app submits no forms (does not fall back to default-src)"],
  ])("sets %s 'none' — %s", (directive) => {
    expect(CSP.get(directive)).toEqual(["'none'"]);
  });

  it("contains no unsafe keyword, wildcard, or scheme source", () => {
    const every = [...CSP.values()].flat();
    for (const forbidden of ["'unsafe-inline'", "'unsafe-eval'", "'unsafe-hashes'", "*"]) {
      expect(every, `CSP must not contain ${forbidden}`).not.toContain(forbidden);
    }
    for (const source of every) {
      expect(source, `CSP must not allow a whole scheme (${source})`).not.toMatch(
        /^(https?|data|blob|filesystem|ws|wss):$/,
      );
      expect(source, `CSP must not allow a wildcard host (${source})`).not.toContain("*");
    }
  });
});

describe("Permissions-Policy", () => {
  const entries = (HEADERS.get("permissions-policy") ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);

  it.each(["camera", "microphone", "geolocation", "payment", "usb"])(
    "denies %s",
    (feature) => {
      expect(entries).toContain(`${feature}=()`);
    },
  );

  it("grants nothing — every listed feature is an empty allowlist", () => {
    expect(entries.length).toBeGreaterThan(0);
    for (const entry of entries) expect(entry).toMatch(/^[a-z-]+=\(\)$/);
  });

  it("does not list the obsolete interest-cohort (FLoC) feature", () => {
    expect(entries.some((entry) => entry.startsWith("interest-cohort"))).toBe(false);
  });
});

describe("index.html is compatible with the CSP", () => {
  it("has no inline <script> — every script loads from a src", () => {
    const scripts = INDEX_HTML.match(/<script\b[^>]*>/gi) ?? [];
    expect(scripts.length).toBeGreaterThan(0);
    for (const tag of scripts) expect(tag, `inline script: ${tag}`).toMatch(/\bsrc=/i);
  });

  it("has no <style> element or style attribute (style-src 'self' would block them)", () => {
    expect(INDEX_HTML).not.toMatch(/<style\b/i);
    expect(INDEX_HTML).not.toMatch(/\sstyle\s*=/i);
  });

  it("has no inline event-handler attributes", () => {
    expect(INDEX_HTML).not.toMatch(/\son[a-z]+\s*=/i);
  });

  it("does not try to set a CSP in a <meta> tag that could drift from _headers", () => {
    expect(INDEX_HTML).not.toMatch(/http-equiv\s*=\s*["']?content-security-policy/i);
  });
});
