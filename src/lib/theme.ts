/**
 * Colour-theme preference.
 *
 * Three states: "light", "dark", or "system" (follow the operating system). An explicit
 * choice is remembered in localStorage on this device only — it is never sent anywhere —
 * and "system" is simply the absence of a stored choice.
 *
 * Attribute contract, shared with public/theme-init.js (which applies a stored choice before
 * first paint, so a dark-mode visitor never sees a flash of the light theme):
 *
 *   explicit "light" / "dark"  ->  <html data-theme="light" | "dark">
 *   "system"                   ->  no data-theme attribute; CSS follows prefers-color-scheme
 *
 * Leaving "system" attribute-free means the operating system can switch themes live with no
 * JavaScript listener at all: the CSS media query does it.
 */

export type ThemePreference = "light" | "dark" | "system";

/** Must match the key in public/theme-init.js. src/test/theme.test.tsx enforces it. */
export const THEME_STORAGE_KEY = "quiz-on-demand:theme";

/** Browser-chrome colours (mobile address bar), matched to --color-bg in index.css. */
export const THEME_COLORS = { light: "#f6f2ea", dark: "#1b1a18" } as const;

export function readThemePreference(): ThemePreference {
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    return stored === "light" || stored === "dark" ? stored : "system";
  } catch {
    // Storage can be blocked (private browsing, site-data settings). Follow the OS.
    return "system";
  }
}

export function storeThemePreference(preference: ThemePreference): void {
  try {
    if (preference === "system") window.localStorage.removeItem(THEME_STORAGE_KEY);
    else window.localStorage.setItem(THEME_STORAGE_KEY, preference);
  } catch {
    // Unavailable storage: the theme still applies for this visit, it just is not remembered.
  }
}

export function applyThemePreference(preference: ThemePreference): void {
  const root = document.documentElement;
  if (preference === "system") delete root.dataset.theme;
  else root.dataset.theme = preference;

  // index.html carries one theme-color meta per colour scheme. For "system" each keeps its
  // own colour; an explicit choice pins both, so the browser chrome matches the page.
  for (const meta of document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')) {
    const schemeIsDark = (meta.getAttribute("media") ?? "").includes("dark");
    const color =
      preference === "system" ? THEME_COLORS[schemeIsDark ? "dark" : "light"] : THEME_COLORS[preference];
    meta.setAttribute("content", color);
  }
}

/**
 * Run a theme change with a brief cross-fade of colours, unless the visitor prefers reduced
 * motion. The class is removed again so ordinary interactions are not slowed down.
 */
export function withThemeTransition(change: () => void): void {
  const prefersReducedMotion =
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (prefersReducedMotion) {
    change();
    return;
  }

  const root = document.documentElement;
  root.classList.add("theme-transition");
  change();
  window.setTimeout(() => root.classList.remove("theme-transition"), 340);
}
