import { gsap } from "gsap";
import { useLayoutEffect, type RefObject } from "react";
import { EASE_OUT, isWideViewport, prefersReducedMotion } from "./motion";

/**
 * The landing hero's one-time entrance.
 *
 * Plays once per page load: coming back to the landing after a quiz shows the hero at rest.
 * The copy column settles upward as one composition (a short stagger, not line-by-line),
 * while the card stack, its shapes and the callouts drift the last few pixels into the
 * layout they already have in CSS. Nothing arrives from off screen and nothing keeps
 * moving once it has landed. Every tween clears its inline styles on completion so the
 * stylesheet alone describes the resting state afterwards.
 *
 * The `data-entrance` attribute on the root records what happened ("playing", "done",
 * "static") — for tests and for anyone inspecting the DOM, never for styling.
 */

let played = false;

/** Test hook: forget that the entrance has played so a fresh render can play it again. */
export function resetHeroEntrance(): void {
  played = false;
}

const DISTANCE = 12;
const CLEAR = "transform,opacity";

export function useHeroEntrance(scope: RefObject<HTMLElement | null>): void {
  useLayoutEffect(() => {
    const root = scope.current;
    if (!root) return;
    if (played || prefersReducedMotion()) {
      root.setAttribute("data-entrance", "static");
      return;
    }
    root.setAttribute("data-entrance", "playing");

    let tl: gsap.core.Timeline | undefined;
    const ctx = gsap.context(() => {
      tl = gsap.timeline({
        defaults: { ease: EASE_OUT, clearProps: CLEAR },
        onComplete: () => {
          played = true;
          root.setAttribute("data-entrance", "done");
        },
      });

      if (!isWideViewport()) {
        // Narrow screens: two blocks, no stagger, over in half a second.
        tl.from(".hero__copy", { y: 10, opacity: 0, duration: 0.4 }).from(
          ".hero-visual",
          { y: 8, opacity: 0, duration: 0.4 },
          0.1,
        );
        return;
      }

      // Left column: eyebrow, headline, lede and upload card settle as one piece.
      tl.from(".hero__copy > *", { y: DISTANCE, opacity: 0, duration: 0.45, stagger: 0.06 });

      // Right column: the stack assembles from a few pixels off its resting layout.
      tl.from(".demo-card--back-2", { x: 14, y: -6, rotation: "-=3", opacity: 0, duration: 0.5 }, 0.1)
        .from(".demo-card--back-1", { x: 10, y: 4, rotation: "+=2", opacity: 0, duration: 0.5 }, 0.16)
        .from(".demo-card--front", { x: 6, y: 8, opacity: 0, duration: 0.5 }, 0.22)
        .from(
          ".hero-visual__shape",
          { y: 8, scale: 0.92, opacity: 0, duration: 0.45, stagger: 0.04 },
          0.26,
        )
        .from(".callout", { x: 10, y: 6, opacity: 0, duration: 0.4, stagger: 0.05 }, 0.34);
    }, root);

    return () => {
      // Torn down mid-way (the visitor moved on): count it as played, so the landing does
      // not re-run the entrance when they come back. Torn down before a single frame ran
      // (React Strict Mode's rehearsal mount in development): let the real mount play it.
      if (tl && tl.progress() > 0) played = true;
      ctx.revert();
    };
  }, [scope]);
}
