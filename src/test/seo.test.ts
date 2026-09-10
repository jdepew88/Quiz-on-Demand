import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Crawler-facing basics that Lighthouse's SEO audit checks.
 *
 * robots.txt matters more than it looks: wrangler.toml uses single-page-application
 * not-found handling, so without a real file every request for /robots.txt is answered with
 * index.html — which crawlers (and Lighthouse) then parse line by line as robots rules, one
 * "error" per line of HTML.
 */

const path = (...parts: string[]) => resolve(process.cwd(), ...parts);
const ROBOTS_PATH = path("public", "robots.txt");
const robots = existsSync(ROBOTS_PATH) ? readFileSync(ROBOTS_PATH, "utf8") : "";
const directives = robots
  .split(/\r?\n/)
  .map((line) => line.replace(/#.*/, "").trim())
  .filter(Boolean);

describe("public/robots.txt", () => {
  it("exists, so the SPA fallback never serves index.html in its place", () => {
    expect(existsSync(ROBOTS_PATH)).toBe(true);
  });

  it("is plain text, not HTML", () => {
    expect(robots).not.toMatch(/<[a-z!]/i);
  });

  it("starts with a user-agent group", () => {
    expect(directives[0]).toMatch(/^user-agent:\s*\S+/i);
  });

  it("contains only directives crawlers understand", () => {
    for (const line of directives) {
      expect(line).toMatch(/^(user-agent|allow|disallow|sitemap):\s*\S*$/i);
    }
  });

  it("does not block the site from being crawled", () => {
    expect(directives).not.toContainEqual(expect.stringMatching(/^disallow:\s*\/\s*$/i));
  });
});

describe("index.html SEO basics", () => {
  const html = readFileSync(path("index.html"), "utf8");

  it("declares the page language", () => {
    expect(html).toMatch(/<html[^>]*\blang="[a-z]{2}/i);
  });

  it("has a descriptive title", () => {
    expect(html).toMatch(/<title>[^<]{10,}<\/title>/);
  });

  it("has a meta description", () => {
    expect(html).toMatch(/<meta\s+name="description"\s+content="[^"]{50,}"/);
  });

  it("has a mobile viewport", () => {
    expect(html).toMatch(/<meta\s+name="viewport"\s+content="width=device-width/);
  });

  it("is not marked noindex", () => {
    expect(html).not.toMatch(/noindex/i);
  });
});
