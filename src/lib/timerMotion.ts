import { gsap } from "gsap";
import { useLayoutEffect, useRef, type RefObject } from "react";
import { EASE_OUT, prefersReducedMotion } from "./motion";

/**
 * Visual response to a countdown timer's state.
 *
 * There is no timer in the app yet, so nothing renders this. It is the GSAP half of a
 * timed test, written against the states a timer will expose, so that wiring one up means
 * rendering a `TimerState` and calling `useTimerStateMotion` — not deciding animation
 * policy under deadline. The timer logic (ticking, thresholds, auto-submit) belongs to
 * React; this file only reacts to the state React has already decided on.
 *
 *  - normal → warning: colours cross-fade through the CSS transition on the timer's
 *    modifier class. Nothing here moves.
 *  - warning → final: one cue, played once at the moment the final minute starts — the
 *    timer grows to ~1.12× and eases back to its real size. Transform only, so nothing
 *    around it reflows. It never repeats while the state stays "final".
 *  - → expired: handled by the class change; the existing auto-submit does the rest.
 *
 * Under reduced motion the cue is skipped and only the class-driven colour change remains.
 */

export type TimerState = "normal" | "warning" | "final" | "expired";

/** Whether moving from `previous` to `next` is the moment to play the one-minute cue. */
export function shouldPlayFinalMinuteCue(previous: TimerState | null, next: TimerState): boolean {
  // `previous === null` is the first render: a timer that mounts already in its final
  // minute has not just crossed the threshold, so nothing should fire.
  return next === "final" && previous !== null && previous !== "final" && previous !== "expired";
}

export const FINAL_MINUTE_CUE = {
  scale: 1.12,
  iconScale: 1.2,
  grow: 0.28,
  hold: 0.1,
  settle: 0.45,
} as const;

/**
 * Attach the state cues to a timer element. `icon` is optional and gets a slightly larger
 * matching emphasis during the one-minute cue.
 */
export function useTimerStateMotion(
  scope: RefObject<HTMLElement | null>,
  state: TimerState,
  icon?: RefObject<HTMLElement | null>,
): void {
  const previous = useRef<TimerState | null>(null);

  useLayoutEffect(() => {
    const play = shouldPlayFinalMinuteCue(previous.current, state);
    previous.current = state;

    const root = scope.current;
    if (!play || !root || prefersReducedMotion()) return;

    const ctx = gsap.context(() => {
      const { scale, iconScale, grow, hold, settle } = FINAL_MINUTE_CUE;
      const tl = gsap.timeline({ defaults: { transformOrigin: "center center" } });
      tl.to(root, { scale, duration: grow, ease: EASE_OUT })
        .to(root, { scale: 1, duration: settle, ease: "power2.inOut", clearProps: "transform" }, `+=${hold}`);
      const iconEl = icon?.current;
      if (iconEl) {
        tl.to(iconEl, { scale: iconScale, duration: grow, ease: EASE_OUT }, 0).to(
          iconEl,
          { scale: 1, duration: settle, ease: "power2.inOut", clearProps: "transform" },
          grow + hold,
        );
      }
    }, root);

    return () => ctx.revert();
  }, [scope, icon, state]);
}
