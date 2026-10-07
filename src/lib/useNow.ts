import { useEffect, useState } from "react";

/**
 * A wall-clock `now` that re-renders the caller on a steady cadence, and immediately when
 * the tab becomes visible or the window regains focus. It is only a refresh trigger: the
 * timing model derives every figure from timestamps, so after a background spell or a
 * device sleep the next read is already correct.
 *
 * `active: false` stops the ticking (the clock itself keeps running — it is just a time).
 */
export function useNow(active: boolean, intervalMs = 500): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!active) return;
    const refresh = () => setNow(Date.now());
    refresh();
    const id = window.setInterval(refresh, intervalMs);
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("focus", refresh);
    window.addEventListener("pageshow", refresh);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", refresh);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("pageshow", refresh);
    };
  }, [active, intervalMs]);

  return now;
}
