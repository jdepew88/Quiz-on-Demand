import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "../App";
import {
  applyThemePreference,
  readThemePreference,
  THEME_COLORS,
  THEME_STORAGE_KEY,
} from "../lib/theme";

/**
 * Light / dark theme: the toggle, persistence, the pre-paint script, and the token system.
 */

const root = document.documentElement;

function resetTheme() {
  window.localStorage.clear();
  delete root.dataset.theme;
  root.classList.remove("theme-transition");
}

beforeEach(resetTheme);
afterEach(() => {
  resetTheme();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const button = (name: string) => screen.getByRole("button", { name });

describe("theme control", () => {
  it("follows the operating system until the visitor chooses", () => {
    render(<App />);

    expect(root.hasAttribute("data-theme")).toBe(false);
    expect(button("Match system theme")).toHaveAttribute("aria-pressed", "true");
    expect(button("Light theme")).toHaveAttribute("aria-pressed", "false");
    expect(button("Dark theme")).toHaveAttribute("aria-pressed", "false");
  });

  it("is a labelled group of three toggle buttons", () => {
    render(<App />);
    const group = screen.getByRole("group", { name: "Color theme" });
    expect(group.querySelectorAll("button[aria-pressed]")).toHaveLength(3);
  });

  it("switches to dark and remembers the choice on this device", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(button("Dark theme"));

    expect(root.dataset.theme).toBe("dark");
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");
    expect(button("Dark theme")).toHaveAttribute("aria-pressed", "true");
    expect(button("Match system theme")).toHaveAttribute("aria-pressed", "false");
  });

  it("can force light even when the system prefers dark", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(button("Light theme"));

    expect(root.dataset.theme).toBe("light");
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe("light");
  });

  it("restores a remembered choice on the next visit", () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, "dark");
    render(<App />);

    expect(root.dataset.theme).toBe("dark");
    expect(button("Dark theme")).toHaveAttribute("aria-pressed", "true");
  });

  it("forgets the explicit choice when switching back to system", async () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, "dark");
    const user = userEvent.setup();
    render(<App />);

    await user.click(button("Match system theme"));

    expect(root.hasAttribute("data-theme")).toBe(false);
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBeNull();
  });

  it("still switches theme when storage is blocked", async () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    const user = userEvent.setup();
    render(<App />);

    await user.click(button("Dark theme"));

    expect(root.dataset.theme).toBe("dark");
  });

  it("never sends the preference over the network", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const user = userEvent.setup();
    render(<App />);

    await user.click(button("Dark theme"));
    await user.click(button("Light theme"));
    await user.click(button("Match system theme"));

    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe("theme helpers", () => {
  it("treats anything but a stored light/dark as system", () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, "purple");
    expect(readThemePreference()).toBe("system");
  });

  it("pins both theme-color metas for an explicit choice and restores them for system", () => {
    const light = document.createElement("meta");
    light.setAttribute("name", "theme-color");
    light.setAttribute("media", "(prefers-color-scheme: light)");
    const dark = document.createElement("meta");
    dark.setAttribute("name", "theme-color");
    dark.setAttribute("media", "(prefers-color-scheme: dark)");
    document.head.append(light, dark);

    try {
      applyThemePreference("dark");
      expect(light.getAttribute("content")).toBe(THEME_COLORS.dark);
      expect(dark.getAttribute("content")).toBe(THEME_COLORS.dark);

      applyThemePreference("system");
      expect(light.getAttribute("content")).toBe(THEME_COLORS.light);
      expect(dark.getAttribute("content")).toBe(THEME_COLORS.dark);
    } finally {
      light.remove();
      dark.remove();
    }
  });
});

describe("public/theme-init.js (runs before first paint)", () => {
  const source = readFileSync(resolve(process.cwd(), "public", "theme-init.js"), "utf8");
  const run = () => new Function(source)();

  it("uses the same storage key as the app", () => {
    expect(source).toContain(`"${THEME_STORAGE_KEY}"`);
  });

  it("applies a stored choice before the app runs", () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, "dark");
    run();
    expect(root.dataset.theme).toBe("dark");
  });

  it("does nothing when no choice is stored, leaving the OS in charge", () => {
    run();
    expect(root.hasAttribute("data-theme")).toBe(false);
  });

  it("ignores unexpected stored values", () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, "purple");
    run();
    expect(root.hasAttribute("data-theme")).toBe(false);
  });

  it("never throws when storage is blocked", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(run).not.toThrow();
    expect(root.hasAttribute("data-theme")).toBe(false);
  });

  it("is loaded from <head> as a blocking script, before the app bundle", () => {
    const html = readFileSync(resolve(process.cwd(), "index.html"), "utf8");
    const head = html.slice(0, html.indexOf("</head>"));
    const tag = head.match(/<script\b[^>]*src="\/theme-init\.js"[^>]*>/)?.[0];

    expect(tag).toBeTruthy();
    // defer/async/module would all run it after first paint — too late to prevent a flash.
    expect(tag).not.toMatch(/\s(defer|async)\b|type="module"/);
  });
});

describe("design tokens (src/index.css)", () => {
  const css = readFileSync(resolve(process.cwd(), "src", "index.css"), "utf8");

  /** Body of the first rule with exactly this selector. Token blocks contain no nesting. */
  function block(selector: string): string {
    const start = css.indexOf(`${selector} {`);
    if (start === -1) throw new Error(`Selector not found in index.css: ${selector}`);
    const open = css.indexOf("{", start);
    return css.slice(open + 1, css.indexOf("}", open));
  }

  function declarations(body: string): Map<string, string> {
    return new Map(
      body
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .split(";")
        .map((declaration) => declaration.trim())
        .filter(Boolean)
        .map((declaration) => {
          const colon = declaration.indexOf(":");
          return [declaration.slice(0, colon).trim(), declaration.slice(colon + 1).trim()] as const;
        }),
    );
  }

  const light = declarations(block(":root"));
  const darkExplicit = declarations(block(':root[data-theme="dark"]'));
  const darkSystem = declarations(block(":root:not([data-theme])"));

  it("defines the dark palette identically for an explicit choice and for the OS preference", () => {
    expect(darkSystem).toEqual(darkExplicit);
  });

  it("gives every dark token a light counterpart, so nothing is dark-only", () => {
    for (const name of darkExplicit.keys()) {
      expect(light.has(name), `${name} is missing from the light palette`).toBe(true);
    }
  });

  it("switches the browser's own colour scheme (form controls, scrollbars) with the theme", () => {
    expect(light.get("color-scheme")).toBe("light");
    expect(darkExplicit.get("color-scheme")).toBe("dark");
  });

  it("uses no data: URIs, which the production CSP would block", () => {
    expect(css).not.toMatch(/url\(\s*["']?data:/i);
  });
});
