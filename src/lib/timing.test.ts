import { describe, expect, it } from "vitest";
import { shouldPlayFinalMinuteCue } from "./timerMotion";
import {
  FINAL_MINUTE_MS,
  MAX_CUSTOM_MINUTES,
  activateQuestion,
  completeTiming,
  deadline,
  elapsedMs,
  isExpired,
  minutesToMs,
  parseCustomMinutes,
  questionElapsedMs,
  remainingMs,
  startTiming,
  summarizeTiming,
  timerStateFor,
} from "./timing";

/**
 * The timing model, driven entirely by injected timestamps. No test here waits for
 * anything: time is a number we pass in.
 */

const IDS = ["q0", "q1", "q2", "q3"];
const T0 = 1_700_000_000_000;
const sec = (n: number) => n * 1000;

describe("starting the clock", () => {
  it("opens the first question's segment at the start time", () => {
    const timing = startTiming(IDS, T0, null);
    expect(timing.startedAt).toBe(T0);
    expect(timing.completedAt).toBeNull();
    expect(timing.timeLimitMs).toBeNull();
    expect(timing.activeQuestionId).toBe("q0");
    expect(timing.questions.q0).toEqual({ accumulatedMs: 0, activeSince: T0 });
    expect(timing.questions.q3).toEqual({ accumulatedMs: 0, activeSince: null });
  });

  it("stores the chosen limit and derives the deadline from it", () => {
    const timing = startTiming(IDS, T0, minutesToMs(15));
    expect(timing.timeLimitMs).toBe(900_000);
    expect(deadline(timing)).toBe(T0 + 900_000);
    expect(deadline(startTiming(IDS, T0, null))).toBeNull();
  });
});

describe("elapsed and remaining time", () => {
  it("are derived from the wall clock, not from ticks", () => {
    const timing = startTiming(IDS, T0, minutesToMs(60));
    // Nothing "ran" between these two reads; the figures still follow the clock.
    expect(elapsedMs(timing, T0 + sec(5))).toBe(sec(5));
    expect(remainingMs(timing, T0 + sec(5))).toBe(sec(3595));
    expect(elapsedMs(timing, T0 + sec(2_000))).toBe(sec(2_000));
    expect(remainingMs(timing, T0 + sec(2_000))).toBe(sec(1_600));
  });

  it("never go negative and never exceed the limit", () => {
    const timing = startTiming(IDS, T0, minutesToMs(1));
    expect(remainingMs(timing, T0 + sec(90))).toBe(0);
    expect(elapsedMs(timing, T0 + sec(90))).toBe(sec(60));
    expect(elapsedMs(timing, T0 - sec(5))).toBe(0);
    expect(isExpired(timing, T0 + sec(60))).toBe(true);
    expect(isExpired(timing, T0 + sec(59))).toBe(false);
  });

  it("have no remaining time for an untimed quiz", () => {
    const timing = startTiming(IDS, T0, null);
    expect(remainingMs(timing, T0 + sec(100))).toBeNull();
    expect(isExpired(timing, T0 + sec(100_000))).toBe(false);
    expect(elapsedMs(timing, T0 + sec(100_000))).toBe(sec(100_000));
  });
});

describe("per-question timing", () => {
  it("accumulates across visits and stops while another question is active", () => {
    let timing = startTiming(IDS, T0, null);
    timing = activateQuestion(timing, "q1", T0 + sec(26)); // q0: 26 s, q1 starts
    timing = activateQuestion(timing, "q2", T0 + sec(40)); // q1: 14 s
    timing = activateQuestion(timing, "q0", T0 + sec(50)); // q2: 10 s, back to q0
    expect(questionElapsedMs(timing, "q0", T0 + sec(64))).toBe(sec(40)); // 26 + 14 in progress
    expect(questionElapsedMs(timing, "q1", T0 + sec(64))).toBe(sec(14));
    expect(questionElapsedMs(timing, "q2", T0 + sec(64))).toBe(sec(10));
    expect(questionElapsedMs(timing, "q3", T0 + sec(64))).toBe(0);
    expect(timing.questions.q0?.accumulatedMs).toBe(sec(26));
  });

  it("ignores re-activating the question that is already active", () => {
    const timing = startTiming(IDS, T0, null);
    expect(activateQuestion(timing, "q0", T0 + sec(9))).toBe(timing);
  });

  it("ignores unknown questions and anything after completion", () => {
    let timing = startTiming(IDS, T0, null);
    expect(activateQuestion(timing, "nope", T0 + sec(1))).toBe(timing);
    timing = completeTiming(timing, T0 + sec(30));
    expect(activateQuestion(timing, "q1", T0 + sec(31))).toBe(timing);
  });
});

describe("completing the clock", () => {
  it("closes the active question and freezes every figure", () => {
    let timing = startTiming(IDS, T0, minutesToMs(10));
    timing = activateQuestion(timing, "q1", T0 + sec(20));
    timing = completeTiming(timing, T0 + sec(90));
    expect(timing.completedAt).toBe(T0 + sec(90));
    expect(timing.activeQuestionId).toBeNull();
    expect(timing.questions.q1).toEqual({ accumulatedMs: sec(70), activeSince: null });
    // An hour later nothing has moved.
    const later = T0 + sec(3600);
    expect(elapsedMs(timing, later)).toBe(sec(90));
    expect(remainingMs(timing, later)).toBe(sec(510));
    expect(questionElapsedMs(timing, "q1", later)).toBe(sec(70));
  });

  it("completes a timed-out quiz at its deadline, however late that is noticed", () => {
    let timing = startTiming(IDS, T0, minutesToMs(1));
    timing = completeTiming(timing, T0 + sec(75)); // the tab was asleep for 15 s
    expect(timing.completedAt).toBe(T0 + sec(60));
    expect(elapsedMs(timing, T0 + sec(75))).toBe(sec(60));
    expect(remainingMs(timing, T0 + sec(75))).toBe(0);
    expect(questionElapsedMs(timing, "q0", T0 + sec(75))).toBe(sec(60));
  });

  it("is idempotent", () => {
    const once = completeTiming(startTiming(IDS, T0, null), T0 + sec(30));
    expect(completeTiming(once, T0 + sec(60))).toBe(once);
  });
});

describe("timer state thresholds", () => {
  const limit = minutesToMs(20); // warning from 5:00 remaining

  it("is final at exactly 60 seconds and warning just above", () => {
    expect(timerStateFor(FINAL_MINUTE_MS + 1, limit)).toBe("warning");
    expect(timerStateFor(FINAL_MINUTE_MS, limit)).toBe("final");
    expect(timerStateFor(1, limit)).toBe("final");
    expect(timerStateFor(0, limit)).toBe("expired");
  });

  it("warns at a quarter of the original limit or less", () => {
    expect(timerStateFor(limit * 0.25 + 1, limit)).toBe("normal");
    expect(timerStateFor(limit * 0.25, limit)).toBe("warning");
    expect(timerStateFor(limit, limit)).toBe("normal");
  });

  it("lets final take precedence over warning for short limits", () => {
    // Two minutes: a quarter is 30 s, inside the final minute.
    expect(timerStateFor(sec(45), minutesToMs(2))).toBe("final");
    expect(timerStateFor(sec(61), minutesToMs(2))).toBe("normal");
  });

  it("has no countdown state for an untimed quiz", () => {
    expect(timerStateFor(null, null)).toBeNull();
  });

  it("still plays the cue exactly once on the transition into final", () => {
    expect(shouldPlayFinalMinuteCue("warning", "final")).toBe(true);
    expect(shouldPlayFinalMinuteCue("final", "final")).toBe(false);
    expect(shouldPlayFinalMinuteCue(null, "final")).toBe(false);
  });
});

describe("custom minutes", () => {
  it("accepts whole minutes within range", () => {
    expect(parseCustomMinutes("25")).toEqual({ ok: true, minutes: 25 });
    expect(parseCustomMinutes(" 1 ")).toEqual({ ok: true, minutes: 1 });
    expect(parseCustomMinutes(String(MAX_CUSTOM_MINUTES))).toEqual({ ok: true, minutes: 480 });
  });

  it.each([
    ["", "Enter a number of minutes."],
    ["   ", "Enter a number of minutes."],
    ["abc", "Enter whole minutes, using digits only."],
    ["12.5", "Enter whole minutes, using digits only."],
    ["-5", "Enter whole minutes, using digits only."],
    ["0", "Use at least 1 minute."],
    ["481", "Use at most 480 minutes (8 hours)."],
    ["99999999", "Use at most 480 minutes (8 hours)."],
  ])("rejects %j", (input, message) => {
    expect(parseCustomMinutes(input)).toEqual({ ok: false, message });
  });
});

describe("timing summary", () => {
  it("reports total, average, fastest, longest and remaining time", () => {
    let timing = startTiming(IDS, T0, minutesToMs(10));
    timing = activateQuestion(timing, "q1", T0 + sec(12)); // q0 12 s
    timing = activateQuestion(timing, "q2", T0 + sec(138)); // q1 126 s
    timing = activateQuestion(timing, "q3", T0 + sec(170)); // q2 32 s
    timing = completeTiming(timing, T0 + sec(226)); // q3 56 s
    const summary = summarizeTiming(timing, IDS, T0 + sec(226));
    expect(summary.totalMs).toBe(sec(226));
    expect(summary.averageMs).toBe(sec(56.5));
    expect(summary.fastest).toEqual({ questionId: "q0", displayNumber: 1, ms: sec(12) });
    expect(summary.longest).toEqual({ questionId: "q1", displayNumber: 2, ms: sec(126) });
    expect(summary.timeLimitMs).toBe(sec(600));
    expect(summary.remainingMs).toBe(sec(374));
    expect(summary.perQuestionMs).toEqual({ q0: sec(12), q1: sec(126), q2: sec(32), q3: sec(56) });
  });

  it("gives ties to the earlier question and handles an untimed quiz", () => {
    let timing = startTiming(["a", "b"], T0, null);
    timing = activateQuestion(timing, "b", T0 + sec(10));
    timing = completeTiming(timing, T0 + sec(20));
    const summary = summarizeTiming(timing, ["a", "b"], T0 + sec(20));
    expect(summary.fastest?.questionId).toBe("a");
    expect(summary.longest?.questionId).toBe("a");
    expect(summary.remainingMs).toBeNull();
    expect(summary.timeLimitMs).toBeNull();
  });

  it("copes with no questions", () => {
    const timing = startTiming([], T0, null);
    const summary = summarizeTiming(timing, [], T0 + sec(5));
    expect(summary.averageMs).toBe(0);
    expect(summary.fastest).toBeNull();
    expect(summary.longest).toBeNull();
  });
});
