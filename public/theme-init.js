/*
 * Quiz on Demand — apply a remembered light/dark choice before first paint.
 *
 * Loaded from <head> as a classic, blocking script so it runs before the page is painted;
 * a dark-mode visitor therefore never sees a flash of the light theme. It is a file rather
 * than inline code because the production Content-Security-Policy (public/_headers) is
 * script-src 'self' with no 'unsafe-inline'.
 *
 * Contract shared with src/lib/theme.ts: localStorage key "quiz-on-demand:theme", values
 * "light" or "dark". No stored value means "follow the operating system", which the CSS
 * handles on its own — so in that case this script does nothing.
 */
(function () {
  try {
    var stored = window.localStorage.getItem("quiz-on-demand:theme");
    if (stored === "light" || stored === "dark") {
      document.documentElement.setAttribute("data-theme", stored);
    }
  } catch (error) {
    // Storage unavailable (private browsing, blocked site data): follow the OS preference.
  }
})();
