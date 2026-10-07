import { gsap } from "gsap";
import { useLayoutEffect, type DependencyList, type RefObject } from "react";

/**
 * Shared ground rules for every GSAP animation in the app.
 *
 * React owns the state; GSAP only dresses the transitions between states. Every animation
 * is scoped to a component root through `gsap.context()` and reverted on cleanup, which is
 * also what keeps React Strict Mode's double-mounted effects from leaving two timelines
 * behind. Tweens that end in the element's resting state use `clearProps` so the inline
 * styles disappear and the stylesheet is the single source of truth again — a resize after
 * an entrance, for instance, re-lays out purely from CSS.
 */

export const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";
export const WIDE_VIEWPORT_QUERY = "(min-width: 62rem)";

/** The one easing used for arrivals, so every screen settles the same way. */
export const EASE_OUT = "power2.out";

/**
 * True when the visitor has asked for reduced motion — and also when there is no way to
 * ask (no `matchMedia`, as in jsdom), since the safe default is to not move things.
 */
export function prefersReducedMotion(): boolean {
  return mediaMatches(REDUCED_MOTION_QUERY, true);
}

/** True at the two-column breakpoint; false when the viewport cannot be measured. */
export function isWideViewport(): boolean {
  return mediaMatches(WIDE_VIEWPORT_QUERY, false);
}

function mediaMatches(query: string, fallback: boolean): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return fallback;
  try {
    return window.matchMedia(query).matches;
  } catch {
    return fallback;
  }
}

/**
 * Run `build` inside a `gsap.context()` scoped to `scope` before the browser paints, and
 * revert everything it created when the dependencies change or the component unmounts.
 *
 * `build` receives the scope element and is skipped (nothing animates, nothing is written
 * to the DOM) when the ref is empty. It is up to the caller to decide what reduced motion
 * means for its animation; most callers simply return early.
 */
export function useGsapContext<T extends HTMLElement>(
  scope: RefObject<T | null>,
  build: (root: T, ctx: gsap.Context) => void,
  deps: DependencyList,
): void {
  useLayoutEffect(() => {
    const root = scope.current;
    if (!root) return;
    const ctx = gsap.context((self) => build(root, self), root);
    return () => ctx.revert();
    // `build` is intentionally not a dependency: callers pass an inline function and
    // list the state it reads in `deps`, the same contract as useEffect itself.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

/** +1 when moving forward through the questions, -1 when moving back, 0 for no move. */
export function navigationDirection(from: number, to: number): -1 | 0 | 1 {
  if (to > from) return 1;
  if (to < from) return -1;
  return 0;
}
