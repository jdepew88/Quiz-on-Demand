import { afterEach, describe, expect, it, vi } from "vitest";
import { gradeAttempt, buildAttempt, isPerfectScore } from "./attempt";
import {
  REDUCED_MOTION_QUERY,
  WIDE_VIEWPORT_QUERY,
  isWideViewport,
  navigationDirection,
  prefersReducedMotion,
} from "./motion";
import { shouldPlayFinalMinuteCue, type TimerState } from "./timerMotion";
import type { Selections, SourceQuestion } from "./types";

/**
 * The decisions that drive the animations. The animations themselves are not unit tested
 * (no pixel assertions); these cover when they are allowed to run and which way they go.
 */

function mockMatchMedia(matching: string[]) {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: vi.fn((query: string) => ({ matches: matching.includes(query), media: query })),
  });
}

afterEach(() => {
  // jsdom ships without matchMedia; put it back that way after each test.
  delete (window as { matchMedia?: unknown }).matchMedia;
});

describe("reduced motion", () => {
  it("treats a browser with no matchMedia as preferring reduced motion", () => {
    expect(prefersReducedMotion()).toBe(true);
  });

  it("reads the media query when it is available", () => {
    mockMatchMedia([]);
    expect(prefersReducedMotion()).toBe(false);
    mockMatchMedia([REDUCED_MOTION_QUERY]);
    expect(prefersReducedMotion()).toBe(true);
  });

  it("falls back to reduced motion when matchMedia throws", () => {
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      writable: true,
      value: () => {
        throw new Error("boom");
      },
    });
    expect(prefersReducedMotion()).toBe(true);
  });
});

describe("viewport", () => {
  it("assumes a narrow viewport when it cannot be measured", () => {
    expect(isWideViewport()).toBe(false);
  });

  it("reports the two-column breakpoint", () => {
    mockMatchMedia([WIDE_VIEWPORT_QUERY]);
    expect(isWideViewport()).toBe(true);
  });
});

describe("navigation direction", () => {
  it("is forward for Next, backward for Previous, none for the same question", () => {
    expect(navigationDirection(0, 1)).toBe(1);
    expect(navigationDirection(4, 9)).toBe(1);
    expect(navigationDirection(3, 2)).toBe(-1);
    expect(navigationDirection(8, 0)).toBe(-1);
    expect(navigationDirection(2, 2)).toBe(0);
  });
});

describe("final-minute cue", () => {
  it("fires once, on the transition into the final minute", () => {
    expect(shouldPlayFinalMinuteCue("warning", "final")).toBe(true);
    expect(shouldPlayFinalMinuteCue("normal", "final")).toBe(true);
  });

  it("does not repeat while the timer stays in its final minute", () => {
    expect(shouldPlayFinalMinuteCue("final", "final")).toBe(false);
  });

  it("does not fire for any other state change", () => {
    const states: TimerState[] = ["normal", "warning", "final", "expired"];
    for (const previous of states) {
      for (const next of states) {
        if (next === "final" && previous !== "final" && previous !== "expired") continue;
        expect(shouldPlayFinalMinuteCue(previous, next), `${previous} -> ${next}`).toBe(false);
      }
    }
  });

  it("does not fire when a timer first renders already inside its final minute", () => {
    expect(shouldPlayFinalMinuteCue(null, "final")).toBe(false);
  });

  it("does not fire when going backwards from expired", () => {
    expect(shouldPlayFinalMinuteCue("expired", "final")).toBe(false);
  });
});

describe("perfect score", () => {
  const SOURCE: SourceQuestion[] = [
    { question: "1 + 1", answer: "2", distractors: ["1", "3", "4"] },
    { question: "2 + 2", answer: "4", distractors: ["3", "5", "6"] },
    { question: "3 + 3", answer: "6", distractors: ["5", "7", "8"] },
  ];

  function grade(pick: (correctId: string, choices: string[]) => string | null) {
    const attempt = buildAttempt(SOURCE, 1, () => 0.5);
    const selections: Selections = {};
    for (const question of attempt.questions) {
      const chosen = pick(
        question.correctChoiceId,
        question.choices.map((choice) => choice.id),
      );
      if (chosen) selections[question.id] = chosen;
    }
    return gradeAttempt(attempt, selections);
  }

  it("is true only when every question is answered correctly", () => {
    expect(isPerfectScore(grade((correct) => correct))).toBe(true);
  });

  it("is false with one wrong answer", () => {
    let spoiled = false;
    const result = grade((correct, ids) => {
      if (spoiled) return correct;
      spoiled = true;
      return ids.find((id) => id !== correct) ?? correct;
    });
    expect(result.correct).toBe(2);
    expect(isPerfectScore(result)).toBe(false);
  });

  it("is false with one unanswered question, even though nothing was wrong", () => {
    let skipped = false;
    const result = grade((correct) => {
      if (skipped) return correct;
      skipped = true;
      return null;
    });
    expect(result.incorrect).toBe(0);
    expect(result.unanswered).toBe(1);
    expect(isPerfectScore(result)).toBe(false);
  });

  it("is decided from the counts, not from a rounded percentage", () => {
    expect(
      isPerfectScore({ total: 250, correct: 249, incorrect: 1, unanswered: 0, percent: 99.6, entries: [] }),
    ).toBe(false);
    expect(
      isPerfectScore({ total: 250, correct: 249, incorrect: 0, unanswered: 1, percent: 100, entries: [] }),
    ).toBe(false);
    expect(isPerfectScore({ total: 0, correct: 0, incorrect: 0, unanswered: 0, percent: 0, entries: [] })).toBe(
      false,
    );
  });
});
