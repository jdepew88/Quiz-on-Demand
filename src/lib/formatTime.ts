/**
 * Time formatting, shared by the quiz header, results and review so every duration in the
 * app is written the same way. Every function treats NaN, Infinity, negatives and
 * undefined as zero — a clock should never print garbage.
 */

function safeMs(ms: number | null | undefined): number {
  return typeof ms === "number" && Number.isFinite(ms) && ms > 0 ? ms : 0;
}

/**
 * Clock style: `23:46`, or `1:03:18` once an hour has passed. Elapsed time rounds down (a
 * second counts once it has fully passed); a countdown rounds up, so it reads `0:01` until
 * the last moment and `0:00` only when nothing is left.
 */
export function formatClock(ms: number | null | undefined, mode: "elapsed" | "remaining" = "elapsed"): string {
  const seconds = mode === "remaining" ? Math.ceil(safeMs(ms) / 1000) : Math.floor(safeMs(ms) / 1000);
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const rest = seconds % 60;
  const mm = hours > 0 ? String(minutes).padStart(2, "0") : String(minutes);
  const ss = String(rest).padStart(2, "0");
  return hours > 0 ? `${hours}:${mm}:${ss}` : `${mm}:${ss}`;
}

/**
 * Spoken style for a single duration: `42 sec`, `1m 18s`, `1h 04m`. Rounded to the
 * nearest second, then to the nearest minute once an hour is reached.
 */
export function formatDuration(ms: number | null | undefined): string {
  const seconds = Math.round(safeMs(ms) / 1000);
  if (seconds < 60) return `${seconds} sec`;
  if (seconds < 3600) {
    const minutes = Math.floor(seconds / 60);
    const rest = seconds % 60;
    return `${minutes}m ${String(rest).padStart(2, "0")}s`;
  }
  const minutes = Math.round(seconds / 60);
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${String(minutes % 60).padStart(2, "0")}m`;
}

/** A time limit written the way it was chosen: `15 minutes`, `1 hour`, `90 minutes`. */
export function formatLimit(ms: number | null | undefined): string {
  const minutes = Math.round(safeMs(ms) / 60_000);
  if (minutes === 60) return "1 hour";
  if (minutes > 0 && minutes % 60 === 0) return `${minutes / 60} hours`;
  return `${minutes} minute${minutes === 1 ? "" : "s"}`;
}
