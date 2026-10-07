import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { gsap } from "gsap";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "../App";
import { REDUCED_MOTION_QUERY, WIDE_VIEWPORT_QUERY } from "../lib/motion";

/**
 * The timed-test feature through the real screens, on a fake clock. `vi.useFakeTimers`
 * owns Date.now and the interval that refreshes the display, so a quiz that "takes" half
 * an hour runs in milliseconds, and every figure the UI shows can be checked exactly.
 *
 * `shouldAdvanceTime` keeps the fake clock moving with real time as well, which is what
 * lets user-event and Testing Library's async queries work under fake timers; the drift
 * is a few milliseconds, far below the whole seconds the assertions read.
 */

const QUIZ = [
  { question: "What is the capital of France?", answer: "Paris", distractors: ["London", "Berlin", "Madrid"] },
  { question: "What is 2 + 2?", answer: "4", distractors: ["3", "5", "6"] },
  { question: "Which planet is closest to the Sun?", answer: "Mercury", distractors: ["Venus", "Mars", "Earth"] },
];
const ANSWERS = new Map(QUIZ.map((entry) => [entry.question, entry.answer]));

type User = ReturnType<typeof userEvent.setup>;

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
});

afterEach(() => {
  vi.useRealTimers();
  delete (window as { matchMedia?: unknown }).matchMedia;
  gsap.globalTimeline.timeScale(1);
});

/** Let `ms` of quiz time pass, running the display refresh timers along the way. */
function pass(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

async function openSetup(): Promise<User> {
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
  render(<App />);
  const file = new File([JSON.stringify(QUIZ)], "quiz.json", { type: "application/json" });
  await user.upload(screen.getByLabelText(/choose a json file/i), file);
  await screen.findByText("Ready to begin");
  return user;
}

async function chooseLimit(user: User, choice: string, customMinutes?: string) {
  await user.selectOptions(screen.getByRole("combobox", { name: /time limit/i }), choice);
  if (customMinutes !== undefined) {
    await user.clear(screen.getByRole("textbox", { name: /custom length/i }));
    await user.type(screen.getByRole("textbox", { name: /custom length/i }), customMinutes);
  }
}

async function start(user: User) {
  await user.click(screen.getByRole("button", { name: /start quiz/i }));
  await screen.findByText("Question 1 of 3");
}

function timer(): HTMLElement {
  const el = document.querySelector<HTMLElement>(".timer");
  if (!el) throw new Error("No timer on screen");
  return el;
}

function timerValues(): { elapsed: string; remaining: string | null } {
  const values = [...timer().querySelectorAll<HTMLElement>(".timer__value")].map((v) => v.textContent ?? "");
  return { elapsed: values[0] ?? "", remaining: values[1] ?? null };
}

function currentQuestionText(): string {
  return within(screen.getByRole("main")).getByRole("group").querySelector("legend")?.textContent ?? "";
}

async function answerCorrectly(user: User) {
  const answer = ANSWERS.get(currentQuestionText());
  if (!answer) throw new Error(`No answer for ${currentQuestionText()}`);
  await user.click(screen.getByRole("radio", { name: answer }));
}

async function submit(user: User) {
  await user.click(screen.getAllByRole("button", { name: /submit quiz/i })[0]!);
  const dialog = screen.getByRole("dialog");
  const confirm = within(dialog).queryByRole("button", { name: /submit quiz/i }) ?? within(dialog).getByRole("button", { name: /submit anyway/i });
  await user.click(confirm);
  await screen.findByRole("heading", { name: /quiz complete/i });
}

/** A results-screen timing card's value, found by its label. */
function timingCard(label: string): string | null {
  const dt = screen.queryByText(label, { selector: ".timing-card dt" });
  return dt?.nextElementSibling?.textContent ?? null;
}

describe("untimed quiz", () => {
  it("starts the elapsed clock at Start quiz and shows no countdown", async () => {
    const user = await openSetup();
    // Dawdling on the setup screen does not count.
    pass(45_000);
    await start(user);
    expect(timerValues()).toEqual({ elapsed: "0:00", remaining: null });
    expect(timer().dataset.timerState).toBe("untimed");
    expect(screen.queryByText(/remaining/i, { selector: ".timer__label" })).not.toBeInTheDocument();

    pass(18_000 + 42 * 1000 + 17 * 60_000);
    expect(timerValues().elapsed).toBe("18:00");
  });
});

describe("timed quiz", () => {
  it("stores the chosen preset and counts down from it", async () => {
    const user = await openSetup();
    await chooseLimit(user, "15");
    expect(screen.getByText("Time limit", { selector: "dt" }).nextElementSibling).toHaveTextContent("15 minutes");
    await start(user);
    expect(timerValues()).toEqual({ elapsed: "0:00", remaining: "15:00" });
    expect(timer().dataset.timerState).toBe("normal");

    pass(5 * 60_000);
    expect(timerValues()).toEqual({ elapsed: "5:00", remaining: "10:00" });

    await submit(user);
    expect(timingCard("Time limit")).toBe("15:00");
    expect(timingCard("Time remaining")).toBe("10:00");
  });

  it("derives time from the clock even when no refresh ran in the background", async () => {
    const user = await openSetup();
    await chooseLimit(user, "30");
    await start(user);
    // Jump the wall clock without running a single interval tick (the tab was asleep),
    // then come back: the next refresh reads the real time.
    act(() => {
      vi.setSystemTime(Date.now() + 12 * 60_000 + 34_000);
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(timerValues()).toEqual({ elapsed: "12:34", remaining: "17:26" });
  });
});

describe("custom time limit", () => {
  it("validates the entry and keeps Start quiz waiting until it is valid", async () => {
    const user = await openSetup();
    await chooseLimit(user, "custom");
    const startButton = screen.getByRole("button", { name: /start quiz/i });
    expect(startButton).toBeDisabled();
    expect(screen.getByRole("alert")).toHaveTextContent("Enter a number of minutes.");

    await chooseLimit(user, "custom", "0");
    expect(screen.getByRole("alert")).toHaveTextContent("Use at least 1 minute.");
    await chooseLimit(user, "custom", "-3");
    expect(screen.getByRole("alert")).toHaveTextContent("whole minutes");
    await chooseLimit(user, "custom", "abc");
    expect(screen.getByRole("alert")).toHaveTextContent("whole minutes");
    await chooseLimit(user, "custom", "999");
    expect(screen.getByRole("alert")).toHaveTextContent("at most 480 minutes");
    expect(startButton).toBeDisabled();

    await chooseLimit(user, "custom", "25");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(startButton).toBeEnabled();
    expect(screen.getByText("Time limit", { selector: "dt" }).nextElementSibling).toHaveTextContent("25 minutes");
    await start(user);
    expect(timerValues().remaining).toBe("25:00");
  });

  it("renders the final state straight away for a one-minute quiz, without the cue", async () => {
    const user = await openSetup();
    await chooseLimit(user, "custom", "1");
    await start(user);
    expect(timer().dataset.timerState).toBe("final");
    expect(screen.getByText("Final minute", { selector: ".timer__label" })).toBeInTheDocument();
    expect(timer().style.transform).toBe("");
  });
});

describe("question timing", () => {
  it("accumulates across visits and follows Next and Previous", async () => {
    const user = await openSetup();
    await start(user);
    const first = currentQuestionText();
    pass(26_000);
    await user.click(screen.getByRole("button", { name: /next/i }));
    pass(30_000);
    await user.click(screen.getByRole("button", { name: /previous/i }));
    expect(currentQuestionText()).toBe(first);
    pass(14_000);
    await user.click(screen.getByRole("button", { name: /next/i }));
    pass(5_000);
    await user.click(screen.getByRole("button", { name: /next/i }));
    pass(9_000);
    await submit(user);

    const times = [...document.querySelectorAll(".review-item")].map((item) => ({
      prompt: item.querySelector(".review-item__prompt")?.textContent,
      time: item.querySelector(".review-item__time")?.textContent?.replace("Time spent: ", ""),
    }));
    expect(times.find((t) => t.prompt === first)?.time).toBe("40 sec");
    expect(times.map((t) => t.time)).toEqual(expect.arrayContaining(["40 sec", "35 sec", "9 sec"]));
    expect(timingCard("Total time")).toBe("1:24");
    expect(timingCard("Average per question")).toBe("0:28");
    const facts = screen.getByRole("list", { name: /timing summary/i });
    expect(within(facts).getByText(/^Question \d — 9 sec$/)).toBeInTheDocument();
    expect(within(facts).getByText("Question 1 — 40 sec")).toBeInTheDocument();
    expect(screen.getByText("28 sec / question")).toBeInTheDocument();
  });
});

describe("warning and final minute", () => {
  it("moves through warning into final, plays the cue once, and marks the label", async () => {
    // Motion allowed, so the GSAP cue is live; timelines run at 50x.
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      writable: true,
      value: vi.fn((query: string) => ({ matches: query === WIDE_VIEWPORT_QUERY, media: query })),
    });
    gsap.globalTimeline.timeScale(50);
    const user = await openSetup();
    await chooseLimit(user, "custom", "8"); // warning from 2:00 remaining
    await start(user);
    const timelines = vi.spyOn(gsap, "timeline");

    pass(5 * 60_000 + 59_000); // 2:01 left
    expect(timer().dataset.timerState).toBe("normal");
    pass(1_500); // 1:59.5 left
    expect(timer().dataset.timerState).toBe("warning");
    expect(timelines).not.toHaveBeenCalled();

    pass(59_000 + 800); // ~59.7 s left
    expect(timer().dataset.timerState).toBe("final");
    expect(screen.getByText("Final minute", { selector: ".timer__label" })).toBeInTheDocument();
    expect(timelines).toHaveBeenCalledTimes(1);

    pass(20_000);
    expect(timer().dataset.timerState).toBe("final");
    expect(timelines).toHaveBeenCalledTimes(1);
    expect(timerValues().remaining).toMatch(/^0:(3|4)\d$/);
  });

  it("communicates the final minute without scaling under reduced motion", async () => {
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      writable: true,
      value: vi.fn((query: string) => ({ matches: query === REDUCED_MOTION_QUERY, media: query })),
    });
    const user = await openSetup();
    await chooseLimit(user, "custom", "2");
    await start(user);
    const timelines = vi.spyOn(gsap, "timeline");
    pass(61_000);
    expect(timer().dataset.timerState).toBe("final");
    expect(screen.getByText("Final minute", { selector: ".timer__label" })).toBeInTheDocument();
    expect(timelines).not.toHaveBeenCalled();
    expect(timer().style.transform).toBe("");
  });
});

describe("expiry", () => {
  it("submits once at zero, keeps unanswered questions unanswered, and freezes the clock", async () => {
    const user = await openSetup();
    await chooseLimit(user, "custom", "1");
    await start(user);
    await answerCorrectly(user);
    pass(30_000);
    expect(timerValues().remaining).toBe("0:30");

    pass(31_000);
    expect(await screen.findByRole("heading", { name: /quiz complete/i })).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Time’s up");
    expect(screen.getByText("1 out of 3 correct")).toBeInTheDocument();
    expect(screen.getByText("Unanswered", { selector: "dt" }).nextElementSibling).toHaveTextContent("2");
    expect(timingCard("Total time")).toBe("1:00");
    expect(timingCard("Time remaining")).toBe("0:00");

    // Long after, nothing has changed and there is still exactly one results screen.
    pass(5 * 60_000);
    expect(timingCard("Total time")).toBe("1:00");
    expect(screen.getAllByRole("heading", { name: /quiz complete/i })).toHaveLength(1);
    expect(screen.getByText("Attempt 1", { exact: false })).toBeInTheDocument();
  });

  it("never shows a negative remaining time while expiry is being noticed", async () => {
    const user = await openSetup();
    await chooseLimit(user, "custom", "1");
    await start(user);
    // Wake up well past the deadline with no ticks in between.
    act(() => {
      vi.setSystemTime(Date.now() + 90_000);
      document.dispatchEvent(new Event("visibilitychange"));
    });
    const stillOnQuiz = document.querySelector(".timer__value");
    if (stillOnQuiz) expect(stillOnQuiz.textContent).not.toMatch(/-/);
    expect(await screen.findByRole("heading", { name: /quiz complete/i })).toBeInTheDocument();
    expect(timingCard("Time remaining")).toBe("0:00");
    expect(timingCard("Total time")).toBe("1:00");
  });
});

describe("manual submission", () => {
  it("finalises the current question and the total, and does not drift afterwards", async () => {
    const user = await openSetup();
    await chooseLimit(user, "30");
    await start(user);
    pass(50_000);
    await user.click(screen.getByRole("button", { name: /next/i }));
    pass(40_000);
    await answerCorrectly(user);
    await submit(user);

    expect(timingCard("Total time")).toBe("1:30");
    expect(timingCard("Time limit")).toBe("30:00");
    expect(timingCard("Time remaining")).toBe("28:30");
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    const times = [...document.querySelectorAll(".review-item__time")].map((el) => el.textContent?.replace("Time spent: ", ""));
    expect(times).toEqual(expect.arrayContaining(["50 sec", "40 sec", "0 sec"]));

    pass(10 * 60_000);
    expect(timingCard("Total time")).toBe("1:30");
    expect(times).toEqual([...document.querySelectorAll(".review-item__time")].map((el) => el.textContent?.replace("Time spent: ", "")));
  });

  it("keeps the time limit for Take it again and starts a fresh clock", async () => {
    const user = await openSetup();
    await chooseLimit(user, "45");
    await start(user);
    pass(120_000);
    await submit(user);
    await user.click(screen.getByRole("button", { name: /take it again/i }));
    await screen.findByText("Question 1 of 3");
    expect(timerValues()).toEqual({ elapsed: "0:00", remaining: "45:00" });
  });
});

describe("perfect score with timing", () => {
  it("keeps the perfect-score state and shows the timing beside it", async () => {
    const user = await openSetup();
    await chooseLimit(user, "15");
    await start(user);
    for (let i = 0; i < QUIZ.length; i += 1) {
      pass(20_000);
      await answerCorrectly(user);
      if (i < QUIZ.length - 1) await user.click(screen.getByRole("button", { name: /next/i }));
    }
    await submit(user);
    const score = document.querySelector(".score");
    expect(score?.classList.contains("score--perfect")).toBe(true);
    expect(screen.getByText("Perfect score")).toBeInTheDocument();
    expect(timingCard("Total time")).toBe("1:00");
    expect(timingCard("Average per question")).toBe("0:20");
    expect(timingCard("Time remaining")).toBe("14:00");
    expect(screen.getByText("20 sec / question")).toBeInTheDocument();
  });
});
