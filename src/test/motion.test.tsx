import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { gsap } from "gsap";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "../App";
import { REDUCED_MOTION_QUERY, WIDE_VIEWPORT_QUERY } from "../lib/motion";
import { resetHeroEntrance } from "../lib/useHeroEntrance";

/**
 * The GSAP transitions, exercised through the real screens. jsdom has no layout, so these
 * never look at pixels: they check what the animations are allowed to do (play, skip,
 * which direction), that the app state is right on the other side of every transition,
 * and that everything comes to rest. The global timeline runs at 50× so a 1.5 s sequence
 * is over in a few frames.
 */

const QUIZ = [
  { question: "What is the capital of France?", answer: "Paris", distractors: ["London", "Berlin", "Madrid"] },
  { question: "What is 2 + 2?", answer: "4", distractors: ["3", "5", "6"] },
  { question: "Which planet is closest to the Sun?", answer: "Mercury", distractors: ["Venus", "Mars", "Earth"] },
];
const ANSWERS = new Map(QUIZ.map((entry) => [entry.question, entry.answer]));

type User = ReturnType<typeof userEvent.setup>;

/** Install matchMedia so motion is allowed (or not), on a wide or narrow viewport. */
function mockMedia({ reduce = false, wide = true } = {}) {
  const matching = [...(reduce ? [REDUCED_MOTION_QUERY] : []), ...(wide ? [WIDE_VIEWPORT_QUERY] : [])];
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: vi.fn((query: string) => ({
      matches: matching.includes(query),
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  });
}

// A full upload → quiz → submit → results walk takes several seconds of jsdom time,
// nothing to do with the animations (they run at 50× here). The default 5 s budget is
// too tight for the longer flows below.
vi.setConfig({ testTimeout: 30_000 });

beforeEach(() => {
  resetHeroEntrance();
  gsap.globalTimeline.timeScale(50);
});

afterEach(() => {
  gsap.globalTimeline.timeScale(1);
  delete (window as { matchMedia?: unknown }).matchMedia;
});

async function startQuiz(): Promise<User> {
  const user = userEvent.setup();
  render(<App />);
  const file = new File([JSON.stringify(QUIZ)], "quiz.json", { type: "application/json" });
  await user.upload(screen.getByLabelText(/choose a json file/i), file);
  await user.click(await screen.findByRole("button", { name: /start quiz/i }));
  return user;
}

function questionGroup(): HTMLElement {
  return within(screen.getByRole("main")).getByRole("group");
}

function currentQuestionText(): string {
  return questionGroup().querySelector("legend")?.textContent ?? "";
}

function questionInner(): HTMLElement {
  const inner = document.querySelector<HTMLElement>(".question-card__inner");
  if (!inner) throw new Error("No question on screen");
  return inner;
}

async function answerCurrent(user: User, correctly: boolean) {
  const answer = ANSWERS.get(currentQuestionText());
  if (!answer) throw new Error(`No known answer for "${currentQuestionText()}"`);
  const correct = screen.getByRole("radio", { name: answer });
  const target = correctly
    ? correct
    : screen.getAllByRole<HTMLInputElement>("radio").find((radio) => radio !== correct)!;
  await user.click(target);
}

/** Take the whole quiz, getting `wrong` of the three questions wrong, and submit. */
async function finishQuiz(user: User, wrong: number) {
  for (let i = 0; i < QUIZ.length; i += 1) {
    await answerCurrent(user, i >= wrong);
    if (i < QUIZ.length - 1) {
      await user.click(screen.getByRole("button", { name: /next/i }));
      await screen.findByText(`Question ${i + 2} of ${QUIZ.length}`);
    }
  }
  await user.click(screen.getAllByRole("button", { name: /submit quiz/i })[0]!);
  const dialog = screen.queryByRole("dialog");
  if (dialog) await user.click(within(dialog).getByRole("button", { name: /submit quiz/i }));
  return screen.findByRole("heading", { name: /quiz complete/i });
}

function scoreSection(): HTMLElement {
  const section = document.querySelector<HTMLElement>(".score");
  if (!section) throw new Error("No score section");
  return section;
}

describe("homepage hero entrance", () => {
  it("plays once on first render and leaves the hero at rest", async () => {
    mockMedia();
    render(<App />);
    const hero = document.querySelector<HTMLElement>(".hero")!;
    expect(hero.dataset.entrance).toBe("playing");

    await waitFor(() => expect(hero.dataset.entrance).toBe("done"));
    // Every animated element is back under the stylesheet's control.
    for (const selector of [".hero__title", ".upload", ".demo-card--front", ".callout"]) {
      const element = hero.querySelector<HTMLElement>(selector)!;
      expect(element.style.opacity).toBe("");
      expect(element.style.transform).toBe("");
    }
    // Nothing was hidden or removed for the sake of the animation.
    expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();
    expect(screen.getByLabelText(/choose a json file/i)).toBeInTheDocument();
  });

  it("does not play again when returning to the landing page", async () => {
    mockMedia();
    const user = userEvent.setup();
    render(<App />);
    await waitFor(() => expect(document.querySelector<HTMLElement>(".hero")!.dataset.entrance).toBe("done"));

    const file = new File([JSON.stringify(QUIZ)], "quiz.json", { type: "application/json" });
    await user.upload(screen.getByLabelText(/choose a json file/i), file);
    await user.click(await screen.findByRole("button", { name: /choose a different file/i }));

    const hero = document.querySelector<HTMLElement>(".hero")!;
    expect(hero.querySelector<HTMLElement>(".hero__title")!.style.opacity).toBe("");
    expect(hero.dataset.entrance).toBeUndefined();
  });

  it("keeps the narrow-viewport entrance to two blocks", async () => {
    mockMedia({ wide: false });
    render(<App />);
    const hero = document.querySelector<HTMLElement>(".hero")!;
    // Narrow screens animate the copy column as a whole, not its children.
    expect(hero.querySelector<HTMLElement>(".hero__copy")!.style.opacity).not.toBe("");
    expect(hero.querySelector<HTMLElement>(".hero__title")!.style.opacity).toBe("");
    await waitFor(() => expect(hero.dataset.entrance).toBe("done"));
  });

  it("renders straight to the final layout under reduced motion", () => {
    mockMedia({ reduce: true });
    render(<App />);
    const hero = document.querySelector<HTMLElement>(".hero")!;
    expect(hero.dataset.entrance).toBe("static");
    expect(hero.querySelector<HTMLElement>(".hero__title")!.style.opacity).toBe("");
    expect(hero.querySelector<HTMLElement>(".demo-card--front")!.style.transform).toBe("");
  });
});

describe("question transitions", () => {
  it("moves forward and back with the matching direction, keeping state and focus", async () => {
    mockMedia();
    const user = await startQuiz();
    const first = currentQuestionText();
    await answerCurrent(user, true);

    await user.click(screen.getByRole("button", { name: /next/i }));
    await screen.findByText("Question 2 of 3");
    expect(questionInner().dataset.direction).toBe("next");
    expect(currentQuestionText()).not.toBe(first);
    expect(questionGroup().querySelector("legend")).toHaveFocus();

    await user.click(screen.getByRole("button", { name: /previous/i }));
    await screen.findByText("Question 1 of 3");
    expect(questionInner().dataset.direction).toBe("previous");
    expect(currentQuestionText()).toBe(first);
    expect(screen.getByRole("radio", { name: ANSWERS.get(first)! })).toBeChecked();

    // Once the enter animation is done the wrapper carries no inline styles.
    await waitFor(() => {
      expect(questionInner().style.opacity).toBe("");
      expect(questionInner().style.transform).toBe("");
    });
  });

  it("lands on the right question when Next is pressed twice quickly", async () => {
    mockMedia();
    const user = await startQuiz();
    const next = screen.getByRole("button", { name: /next/i });
    await user.click(next);
    await user.click(next);
    await screen.findByText("Question 3 of 3");
    expect(screen.getAllByRole("button", { name: /submit quiz/i })).toHaveLength(2);
    expect(screen.queryByText("Question 2 of 3")).not.toBeInTheDocument();
  });

  it("restores the current question when Previous interrupts a Next in flight", async () => {
    mockMedia();
    const user = await startQuiz();
    const first = currentQuestionText();
    // Slow the clock right down so the second press lands while the exit is still running.
    gsap.globalTimeline.timeScale(0.01);
    await user.click(screen.getByRole("button", { name: /next/i }));
    expect(questionInner().style.opacity).not.toBe("");
    gsap.globalTimeline.timeScale(50);
    await user.click(screen.getByRole("button", { name: /previous/i }));

    expect(screen.getByText("Question 1 of 3")).toBeInTheDocument();
    expect(currentQuestionText()).toBe(first);
    await waitFor(() => {
      expect(questionInner().style.opacity).toBe("");
      expect(questionInner().style.transform).toBe("");
    });
  });

  it("jumps from the navigator with the right direction", async () => {
    mockMedia();
    const user = await startQuiz();
    await user.click(screen.getByRole("button", { name: /question 3, not answered/i }));
    await screen.findByText("Question 3 of 3");
    expect(questionInner().dataset.direction).toBe("next");
    await user.click(screen.getByRole("button", { name: /question 1, not answered/i }));
    await screen.findByText("Question 1 of 3");
    expect(questionInner().dataset.direction).toBe("previous");
  });

  it("does not move the first question on first paint", async () => {
    mockMedia();
    await startQuiz();
    expect(questionInner().dataset.direction).toBeUndefined();
    expect(questionInner().style.transform).toBe("");
  });

  it("switches instantly, with no transform, under reduced motion", async () => {
    mockMedia({ reduce: true });
    const user = await startQuiz();
    await user.click(screen.getByRole("button", { name: /next/i }));
    // Synchronous: no exit tween was waited on.
    expect(screen.getByText("Question 2 of 3")).toBeInTheDocument();
    expect(questionInner().dataset.direction).toBeUndefined();
    expect(questionInner().style.transform).toBe("");
    expect(questionGroup().querySelector("legend")).toHaveFocus();
  });
});

describe("results animation", () => {
  it("counts the percentage up to the real value and comes to rest", async () => {
    mockMedia();
    const user = await startQuiz();
    await finishQuiz(user, 1);

    const score = scoreSection();
    expect(score.classList.contains("score--perfect")).toBe(false);
    expect(score.querySelector(".score__spark")).toBeNull();
    expect(screen.getByText("Your score")).toBeInTheDocument();
    // The hidden copy carries the final value from the first render.
    expect(score.querySelector(".score__percent .visually-hidden"))
      .toHaveTextContent("66.7%");

    await waitFor(() => expect(score.dataset.entrance).toBe("done"));
    expect(score.querySelector(".score__percent-value")).toHaveTextContent("66.7%");
    for (const selector of [".score__percent", ".result-card", ".score__actions"]) {
      expect(score.querySelector<HTMLElement>(selector)!.style.opacity).toBe("");
    }
  });

  it("celebrates a genuine 100% once, then goes static", async () => {
    mockMedia();
    const user = await startQuiz();
    await finishQuiz(user, 0);

    const score = scoreSection();
    expect(score.classList.contains("score--perfect")).toBe(true);
    expect(screen.getByText("Perfect score")).toBeInTheDocument();
    expect(score.querySelector(".score__sweep")).not.toBeNull();
    expect(score.querySelectorAll(".score__spark").length).toBeGreaterThan(0);

    await waitFor(() => expect(score.dataset.entrance).toBe("done"));
    expect(score.querySelector(".score__percent-value")).toHaveTextContent("100%");
    // Sparks have faded out and stay out; the highlight has settled at full width.
    for (const spark of score.querySelectorAll<HTMLElement>(".score__spark")) {
      expect(spark.style.opacity).toBe("0");
    }
    expect(score.querySelector<HTMLElement>(".score__sweep")!.style.transform).toBe("");
    expect(gsap.globalTimeline.getChildren(true, true, true).filter((t) => t.isActive())).toHaveLength(0);
  });

  it("does not celebrate when a question was left unanswered", async () => {
    mockMedia();
    const user = await startQuiz();
    // Answer two of three correctly and skip the last one.
    await answerCurrent(user, true);
    await user.click(screen.getByRole("button", { name: /next/i }));
    await screen.findByText("Question 2 of 3");
    await answerCurrent(user, true);
    await user.click(screen.getAllByRole("button", { name: /submit quiz/i })[0]!);
    const dialog = screen.getByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: /submit anyway/i }));
    await screen.findByRole("heading", { name: /quiz complete/i });

    const score = scoreSection();
    expect(score.classList.contains("score--perfect")).toBe(false);
    expect(score.querySelector(".score__sweep")).toBeNull();
    expect(screen.getByText("Your score")).toBeInTheDocument();
  });

  it("plays a fresh, single celebration on a repeated perfect attempt", async () => {
    mockMedia();
    const user = await startQuiz();
    await finishQuiz(user, 0);
    await waitFor(() => expect(scoreSection().dataset.entrance).toBe("done"));

    await user.click(screen.getByRole("button", { name: /take it again/i }));
    await screen.findByText("Question 1 of 3");
    await finishQuiz(user, 0);

    const score = scoreSection();
    expect(score.classList.contains("score--perfect")).toBe(true);
    expect(score.querySelectorAll(".score__burst")).toHaveLength(1);
    await waitFor(() => expect(score.dataset.entrance).toBe("done"));
  });

  it("shows the final score immediately, with no burst, under reduced motion", async () => {
    mockMedia({ reduce: true });
    const user = await startQuiz();
    await finishQuiz(user, 0);

    const score = scoreSection();
    expect(score.dataset.entrance).toBe("static");
    expect(score.classList.contains("score--perfect")).toBe(true);
    expect(screen.getByText("Perfect score")).toBeInTheDocument();
    expect(score.querySelector(".score__percent-value")).toHaveTextContent("100%");
    expect(score.querySelector(".score__sweep")).not.toBeNull();
    expect(score.querySelector(".score__burst")).toBeNull();
    expect(score.querySelector<HTMLElement>(".score__percent")!.style.opacity).toBe("");
  });
});
