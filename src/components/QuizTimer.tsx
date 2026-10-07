import { useEffect, useRef, useState } from "react";
import { IconClock } from "./Icons";
import { formatClock } from "../lib/formatTime";
import { useTimerStateMotion, type TimerState } from "../lib/timerMotion";
import { elapsedMs, remainingMs, timerStateFor, type QuizTiming } from "../lib/timing";

/**
 * The compact timing readout in the quiz bar: elapsed time on every quiz, plus the
 * countdown on a timed one. Purely presentational — the state (normal / warning / final /
 * expired) is derived from the timing model, the GSAP cue in `useTimerStateMotion` reacts
 * to it, and the only thing this component decides for itself is when to say something
 * to a screen reader.
 *
 * The ticking figures are `aria-hidden`; a hidden polite region announces three
 * milestones at most (five minutes, one minute, time up) rather than every second.
 */

const LABEL: Record<TimerState, string> = {
  normal: "Remaining",
  warning: "Remaining",
  final: "Final minute",
  expired: "Time's up",
};

export function QuizTimer({ timing, now }: { timing: QuizTiming; now: number }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const iconRef = useRef<HTMLSpanElement>(null);
  const elapsed = elapsedMs(timing, now);
  const remaining = remainingMs(timing, now);
  const state = timerStateFor(remaining, timing.timeLimitMs);

  useTimerStateMotion(rootRef, state ?? "normal", iconRef);

  // Milestone announcements, only when a threshold is crossed downwards. A quiz that
  // starts inside a threshold says nothing about it: the visible countdown already does.
  const [announcement, setAnnouncement] = useState("");
  const previousRemaining = useRef<number | null>(null);
  useEffect(() => {
    if (remaining === null) return;
    const previous = previousRemaining.current;
    previousRemaining.current = remaining;
    if (previous === null) return;
    if (previous > 0 && remaining === 0) {
      setAnnouncement("Time is up. Your answers were submitted automatically.");
    } else if (previous > 60_000 && remaining <= 60_000) {
      setAnnouncement("1 minute remaining.");
    } else if (previous > 300_000 && remaining <= 300_000) {
      setAnnouncement("5 minutes remaining.");
    }
  }, [remaining]);

  const classes = ["timer", state ? `timer--${state}` : ""].filter(Boolean).join(" ");

  return (
    <div
      ref={rootRef}
      className={classes}
      data-timer-state={state ?? "untimed"}
    >
      <span className="timer__icon" ref={iconRef} aria-hidden="true">
        <IconClock size={16} />
      </span>
      <div className="timer__item">
        <span className="timer__label">Elapsed</span>
        <span className="timer__value" aria-hidden="true">
          {formatClock(elapsed)}
        </span>
        <span className="visually-hidden">Elapsed {formatClock(elapsed)}</span>
      </div>
      {remaining !== null && state && (
        <div className="timer__item timer__item--remaining">
          {/* The label changes with the state; the stack keeps the slot as wide as the
              widest label, so the pill never resizes when the state changes. */}
          <span className="timer__label-stack">
            <span className="timer__label">{LABEL[state]}</span>
            <span className="timer__sizer" aria-hidden="true">
              {LABEL.final}
            </span>
          </span>
          <span className="timer__value" aria-hidden="true">
            {formatClock(remaining, "remaining")}
          </span>
          <span className="visually-hidden">
            {LABEL[state]} {formatClock(remaining, "remaining")}
          </span>
        </div>
      )}
      <span className="visually-hidden" aria-live="polite" aria-atomic="true">
        {announcement}
      </span>
    </div>
  );
}
