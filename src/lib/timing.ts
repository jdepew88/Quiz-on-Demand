import type { TimerState } from "./timerMotion";

/**
 * Quiz timing.
 *
 * Timestamps are the only source of truth. Nothing here counts seconds: every elapsed,
 * remaining or per-question figure is derived from `startedAt`, `completedAt`, the segment
 * boundaries recorded as the active question changes, and the `now` the caller passes in.
 * That is what makes the clock behave like a real exam clock when the tab is in the
 * background or the device sleeps — the next render simply reads the wall clock.
 *
 * Everything is immutable: each transition returns a new `QuizTiming`, so React state
 * updates stay simple and the model is trivial to test with injected timestamps.
 */

export interface QuestionTiming {
  /** Time from finished segments, in ms. */
  accumulatedMs: number;
  /** Start of the segment in progress, or null while the question is not the active one. */
  activeSince: number | null;
}

export interface QuizTiming {
  startedAt: number;
  /** Set once, when the quiz is submitted; nothing changes afterwards. */
  completedAt: number | null;
  timeLimitMs: number | null;
  questions: Record<string, QuestionTiming>;
  activeQuestionId: string | null;
}

/** How a quiz ended. */
export type SubmissionKind = "manual" | "timeout";

export const FINAL_MINUTE_MS = 60_000;
/** Warning begins when this fraction of the original limit (or less) remains. */
export const WARNING_FRACTION = 0.25;

/** Preset time limits, in minutes. */
export const TIME_LIMIT_PRESETS = [15, 30, 45, 60, 90] as const;
export const MIN_CUSTOM_MINUTES = 1;
export const MAX_CUSTOM_MINUTES = 480;

export function minutesToMs(minutes: number): number {
  return Math.round(minutes * 60_000);
}

/** Start the clock. The first question's segment opens immediately. */
export function startTiming(
  questionIds: readonly string[],
  now: number,
  timeLimitMs: number | null,
): QuizTiming {
  const questions: Record<string, QuestionTiming> = {};
  for (const id of questionIds) questions[id] = { accumulatedMs: 0, activeSince: null };
  const first = questionIds[0] ?? null;
  if (first !== null) questions[first] = { accumulatedMs: 0, activeSince: now };
  return { startedAt: now, completedAt: null, timeLimitMs, questions, activeQuestionId: first };
}

/** Close the active question's segment at `at`, if one is open. */
function closeActive(timing: QuizTiming, at: number): QuizTiming {
  const id = timing.activeQuestionId;
  if (id === null) return timing;
  const current = timing.questions[id];
  if (!current || current.activeSince === null) return timing;
  return {
    ...timing,
    questions: {
      ...timing.questions,
      [id]: {
        accumulatedMs: current.accumulatedMs + Math.max(0, at - current.activeSince),
        activeSince: null,
      },
    },
    activeQuestionId: null,
  };
}

/**
 * Make `questionId` the active question: the previous one's segment is closed and a new
 * one opens for this question, adding to whatever it accumulated on earlier visits.
 * A no-op once the quiz is complete or when the question is already active.
 */
export function activateQuestion(timing: QuizTiming, questionId: string, now: number): QuizTiming {
  if (timing.completedAt !== null || timing.activeQuestionId === questionId) return timing;
  if (!(questionId in timing.questions)) return timing;
  const closed = closeActive(timing, now);
  const existing = closed.questions[questionId] ?? { accumulatedMs: 0, activeSince: null };
  return {
    ...closed,
    questions: { ...closed.questions, [questionId]: { ...existing, activeSince: now } },
    activeQuestionId: questionId,
  };
}

/** The wall-clock moment a timed quiz runs out; null when untimed. */
export function deadline(timing: QuizTiming): number | null {
  return timing.timeLimitMs === null ? null : timing.startedAt + timing.timeLimitMs;
}

/**
 * Freeze the clock. Closes the active segment and records the completion time. A quiz
 * that ran out of time completes at its deadline, never later, so a late tick (the tab was
 * asleep) does not inflate the figures. Idempotent.
 */
export function completeTiming(timing: QuizTiming, now: number): QuizTiming {
  if (timing.completedAt !== null) return timing;
  const end = deadline(timing);
  const at = Math.max(timing.startedAt, end === null ? now : Math.min(now, end));
  return { ...closeActive(timing, at), completedAt: at };
}

/** Elapsed ms, clamped at zero and — for a timed quiz — at the limit. */
export function elapsedMs(timing: QuizTiming, now: number): number {
  const end = timing.completedAt ?? now;
  const raw = Math.max(0, end - timing.startedAt);
  return timing.timeLimitMs === null ? raw : Math.min(raw, timing.timeLimitMs);
}

/** Remaining ms, never negative; null for an untimed quiz. */
export function remainingMs(timing: QuizTiming, now: number): number | null {
  if (timing.timeLimitMs === null) return null;
  return Math.max(0, timing.timeLimitMs - elapsedMs(timing, now));
}

export function isExpired(timing: QuizTiming, now: number): boolean {
  return remainingMs(timing, now) === 0;
}

/** Total time spent on one question so far, including a segment still in progress. */
export function questionElapsedMs(timing: QuizTiming, questionId: string, now: number): number {
  const entry = timing.questions[questionId];
  if (!entry) return 0;
  if (entry.activeSince === null) return entry.accumulatedMs;
  const end = timing.completedAt ?? now;
  return entry.accumulatedMs + Math.max(0, end - entry.activeSince);
}

/**
 * The timer state for a given remaining time. `final` wins over `warning`; both only exist
 * for timed quizzes, so this returns null when there is no limit.
 *
 *   60,001 ms → warning or normal · 60,000 ms → final · 0 ms → expired
 */
export function timerStateFor(remaining: number | null, timeLimitMs: number | null): TimerState | null {
  if (remaining === null || timeLimitMs === null) return null;
  if (remaining <= 0) return "expired";
  if (remaining <= FINAL_MINUTE_MS) return "final";
  if (remaining <= timeLimitMs * WARNING_FRACTION) return "warning";
  return "normal";
}

export type CustomMinutes = { ok: true; minutes: number } | { ok: false; message: string };

/** Validate a custom time limit typed in minutes. Whole minutes, 1 to 480. */
export function parseCustomMinutes(input: string): CustomMinutes {
  const text = input.trim();
  if (text === "") return { ok: false, message: "Enter a number of minutes." };
  if (!/^\d+$/.test(text)) return { ok: false, message: "Enter whole minutes, using digits only." };
  const minutes = Number(text);
  if (!Number.isFinite(minutes) || minutes < MIN_CUSTOM_MINUTES) {
    return { ok: false, message: `Use at least ${MIN_CUSTOM_MINUTES} minute.` };
  }
  if (minutes > MAX_CUSTOM_MINUTES) {
    return { ok: false, message: `Use at most ${MAX_CUSTOM_MINUTES} minutes (8 hours).` };
  }
  return { ok: true, minutes };
}

export interface QuestionTimeFact {
  questionId: string;
  /** 1-based position in the attempt, as shown to the learner. */
  displayNumber: number;
  ms: number;
}

export interface TimingSummary {
  totalMs: number;
  averageMs: number;
  fastest: QuestionTimeFact | null;
  longest: QuestionTimeFact | null;
  timeLimitMs: number | null;
  remainingMs: number | null;
  /** Per-question totals, keyed by question id. */
  perQuestionMs: Record<string, number>;
}

/**
 * The figures the results screen shows. Durations only: which question took longest is a
 * fact; why it did is not something the app can know. Ties go to the earlier question.
 */
export function summarizeTiming(
  timing: QuizTiming,
  questionIds: readonly string[],
  now: number,
): TimingSummary {
  const perQuestionMs: Record<string, number> = {};
  let fastest: QuestionTimeFact | null = null;
  let longest: QuestionTimeFact | null = null;
  questionIds.forEach((questionId, index) => {
    const ms = questionElapsedMs(timing, questionId, now);
    perQuestionMs[questionId] = ms;
    const fact = { questionId, displayNumber: index + 1, ms };
    if (fastest === null || ms < fastest.ms) fastest = fact;
    if (longest === null || ms > longest.ms) longest = fact;
  });
  const totalMs = elapsedMs(timing, now);
  return {
    totalMs,
    averageMs: questionIds.length === 0 ? 0 : totalMs / questionIds.length,
    fastest,
    longest,
    timeLimitMs: timing.timeLimitMs,
    remainingMs: remainingMs(timing, now),
    perQuestionMs,
  };
}
