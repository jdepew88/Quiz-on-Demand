import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { App } from "../App";

/**
 * End-to-end behaviour of the actual screens: upload -> validate -> take -> submit ->
 * review -> reshuffle -> reset. These cover the quiz *experience* requirements that the
 * pure-function tests in `src/lib` cannot reach.
 *
 * Because the question order is randomized on purpose, nothing here may assume which
 * question is on screen. Helpers read the visible question text and look its answer up,
 * which is also a standing check that grading stays correct under randomization.
 */

const QUIZ = [
  {
    question: "What is the capital of France?",
    answer: "Paris",
    distractors: ["London", "Berlin", "Madrid"],
  },
  {
    question: "What is 2 + 2?",
    answer: "4",
    distractors: ["3", "5", "6"],
  },
  {
    question: "Which planet is closest to the Sun?",
    answer: "Mercury",
    distractors: ["Venus", "Mars", "Earth"],
    explanation: "Mercury orbits nearest the Sun.",
  },
];

/** Correct answer text keyed by question text, for clicking the right radio. */
const ANSWERS = new Map(QUIZ.map((entry) => [entry.question, entry.answer]));

type User = ReturnType<typeof userEvent.setup>;

function quizFile(data: unknown, name = "my-quiz.json"): File {
  return new File([JSON.stringify(data, null, 2)], name, { type: "application/json" });
}

async function upload(file: File): Promise<User> {
  const user = userEvent.setup();
  render(<App />);
  await user.upload(screen.getByLabelText(/choose a json file/i), file);
  return user;
}

async function startQuiz(data: unknown = QUIZ): Promise<User> {
  const user = await upload(quizFile(data));
  await user.click(await screen.findByRole("button", { name: /start quiz/i }));
  return user;
}

/** The question currently on screen, read from the fieldset's legend. */
function currentQuestionText(): string {
  return questionGroup().querySelector("legend")?.textContent ?? "";
}

function correctRadio(): HTMLInputElement {
  const answer = ANSWERS.get(currentQuestionText());
  if (!answer) throw new Error(`No known answer for: "${currentQuestionText()}"`);
  return screen.getByRole<HTMLInputElement>("radio", { name: answer });
}

function anIncorrectRadio(): HTMLInputElement {
  const correct = correctRadio();
  const wrong = screen
    .getAllByRole<HTMLInputElement>("radio")
    .find((radio) => radio !== correct);
  if (!wrong) throw new Error("Question rendered fewer than two choices");
  return wrong;
}

/** All review cards currently rendered, by outcome class. `queryAll` so that "none" is a
 *  legitimate answer — the filter row can legitimately render an empty list. */
function reviewItems(outcome?: "correct" | "incorrect" | "unanswered"): HTMLElement[] {
  return screen
    .queryAllByRole("listitem")
    .filter(
      (item) =>
        item.classList.contains("review-item") &&
        (outcome === undefined || item.classList.contains(`review-item--${outcome}`)),
    );
}

/** Open the confirmation dialog from the sticky bar. */
async function openSubmitDialog(user: User) {
  await user.click(screen.getAllByRole("button", { name: /submit quiz/i })[0]!);
  return screen.getByRole("dialog");
}

/** The question's fieldset. Scoped to <main>: the header's theme control is a group too. */
function questionGroup(): HTMLElement {
  return within(screen.getByRole("main")).getByRole("group");
}

/** The value of one setup-screen stat tile, found by its label. */
function stat(label: string): HTMLElement {
  const value = screen.getByText(label, { selector: "dt" }).nextElementSibling;
  if (!(value instanceof HTMLElement)) throw new Error(`No value for stat "${label}"`);
  return value;
}

/** Each validation problem as one line of text, e.g. "Question 2: <message>". */
function issueTexts(): string[] {
  return Array.from(document.querySelectorAll(".issues__list li"), (item) => item.textContent ?? "");
}

describe("upload screen", () => {
  it("explains the schema and offers the template and sample downloads", () => {
    render(<App />);

    expect(screen.getByRole("heading", { name: /quiz file format/i })).toBeInTheDocument();
    // Two examples are shown now: the recommended 3-distractor one and a shorter one.
    expect(screen.getAllByText(/"distractors"/).length).toBeGreaterThanOrEqual(2);
    expect(screen.getByRole("link", { name: /download template json/i })).toHaveAttribute(
      "download",
      "quiz-template.json",
    );
    expect(screen.getByRole("link", { name: /download sample quiz/i })).toHaveAttribute(
      "href",
      "/sample-quiz.json",
    );
  });

  it("states the privacy behaviour", () => {
    render(<App />);
    expect(
      screen.getByText(/processed locally in your browser and is not uploaded or stored/i),
    ).toBeInTheDocument();
  });

  it("offers a file picker and a drop target", () => {
    render(<App />);
    expect(screen.getByLabelText(/choose a json file/i)).toBeInTheDocument();
    expect(screen.getByText(/drop your quiz file here/i)).toBeInTheDocument();
  });

  it("reports the valid question count and offers to start", async () => {
    await upload(quizFile(QUIZ));

    expect(await screen.findByText("Ready to begin")).toBeInTheDocument();
    expect(stat("Questions")).toHaveTextContent(/^3$/);
    expect(screen.getByText("my-quiz.json")).toBeInTheDocument();
    // A readable title is derived from the file name, since the format has no title field.
    expect(screen.getByRole("heading", { name: "My Quiz" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /start quiz/i })).toBeEnabled();
  });

  it("singularises a one-question quiz", async () => {
    await upload(quizFile([QUIZ[0]]));
    await screen.findByText("Ready to begin");
    expect(stat("Questions")).toHaveTextContent(/^1$/);
  });

  it("refuses a malformed file and names the offending question", async () => {
    await upload(quizFile([QUIZ[0], { question: "Broken?", answer: "a", distractors: ["b"] }]));

    expect(await screen.findByText(/could not be used/i)).toBeInTheDocument();
    expect(issueTexts()).toContainEqual(expect.stringMatching(/^Question 2: Only 1 distractor supplied\. At least 2 distractors/));
    expect(screen.queryByRole("button", { name: /start quiz/i })).not.toBeInTheDocument();
  });

  it("accepts a two-distractor question that the old exactly-three rule rejected", async () => {
    await upload(quizFile([QUIZ[0], { question: "Fine?", answer: "a", distractors: ["b", "c"] }]));

    await screen.findByText("Ready to begin");
    expect(stat("Questions")).toHaveTextContent(/^2$/);
    expect(screen.getByRole("button", { name: /start quiz/i })).toBeEnabled();
  });

  it("refuses invalid JSON", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.upload(
      screen.getByLabelText(/choose a json file/i),
      new File(['[{"question": '], "bad.json", { type: "application/json" }),
    );

    expect(await screen.findByText(/is not valid JSON/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /start quiz/i })).not.toBeInTheDocument();
  });

  it("says nothing was discarded when a file is rejected", async () => {
    await upload(quizFile([{ question: "Only this" }]));
    expect(await screen.findByText(/nothing was discarded/i)).toBeInTheDocument();
  });

  it("lets a rejected file be swapped for a good one", async () => {
    const user = await upload(quizFile([{ question: "Only this" }]));
    expect(await screen.findByText(/could not be used/i)).toBeInTheDocument();

    await user.upload(screen.getByLabelText(/choose a json file/i), quizFile(QUIZ, "good.json"));

    expect(await screen.findByText("good.json")).toBeInTheDocument();
    expect(screen.queryByText(/could not be used/i)).not.toBeInTheDocument();
  });
});

describe("quiz screen", () => {
  it("shows progress, the question, and one choice per answer supplied", async () => {
    await startQuiz();

    expect(screen.getByText("Question 1 of 3")).toBeInTheDocument();
    // The default fixture uses the recommended 3 distractors, so 4 total choices.
    expect(screen.getAllByRole("radio")).toHaveLength(4);
    expect(screen.getByRole("progressbar")).toHaveAttribute(
      "aria-valuetext",
      "0 of 3 questions answered",
    );
    expect(QUIZ.map((entry) => entry.question)).toContain(currentQuestionText());
  });

  it("marks the current question as unanswered until a choice is made", async () => {
    const user = await startQuiz();
    expect(screen.getByText(/not answered yet/i)).toBeInTheDocument();

    await user.click(correctRadio());

    expect(screen.queryByText(/not answered yet/i)).not.toBeInTheDocument();
    expect(screen.getByText("1 answered · 2 remaining")).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toHaveAttribute(
      "aria-valuetext",
      "1 of 3 questions answered",
    );
  });

  it("moves forward and back, keeping the recorded answer", async () => {
    const user = await startQuiz();
    const firstQuestion = currentQuestionText();
    await user.click(correctRadio());

    await user.click(screen.getByRole("button", { name: /next/i }));
    expect(screen.getByText("Question 2 of 3")).toBeInTheDocument();
    expect(currentQuestionText()).not.toBe(firstQuestion);

    await user.click(screen.getByRole("button", { name: /previous/i }));
    expect(screen.getByText("Question 1 of 3")).toBeInTheDocument();
    expect(currentQuestionText()).toBe(firstQuestion);
    expect(correctRadio()).toBeChecked();
  });

  it("disables Previous on the first question", async () => {
    await startQuiz();
    expect(screen.getByRole("button", { name: /previous/i })).toBeDisabled();
  });

  it("lets an answer be changed before submitting", async () => {
    const user = await startQuiz();

    await user.click(correctRadio());
    expect(correctRadio()).toBeChecked();

    const other = anIncorrectRadio();
    await user.click(other);

    expect(other).toBeChecked();
    expect(correctRadio()).not.toBeChecked();
    // Changing an answer must not count as a second answer.
    expect(screen.getByText("1 answered · 2 remaining")).toBeInTheDocument();
  });

  it("jumps to any question from the navigator and marks answered ones", async () => {
    const user = await startQuiz();
    await user.click(correctRadio());

    const navigator = screen.getByRole("complementary");
    expect(
      within(navigator).getByRole("button", { name: /question 1, answered/i }),
    ).toBeInTheDocument();

    await user.click(within(navigator).getByRole("button", { name: /question 3, not answered/i }));
    expect(screen.getByText("Question 3 of 3")).toBeInTheDocument();
  });

  it("offers Submit instead of Next on the last question", async () => {
    const user = await startQuiz();
    await user.click(screen.getByRole("button", { name: /next/i }));
    await user.click(screen.getByRole("button", { name: /next/i }));

    expect(screen.getByText("Question 3 of 3")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /next/i })).not.toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /submit quiz/i })).toHaveLength(2);
  });
});

describe("submission confirmation", () => {
  it("warns how many questions are unanswered and can return to the quiz", async () => {
    const user = await startQuiz();
    await user.click(correctRadio());
    const dialog = await openSubmitDialog(user);

    expect(dialog).toHaveAccessibleName(/submit with unanswered questions/i);
    expect(within(dialog).getByText(/2 of 3 questions are still unanswered/i)).toBeInTheDocument();

    await user.click(within(dialog).getByRole("button", { name: /return to quiz/i }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByText("Question 1 of 3")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /quiz complete/i })).not.toBeInTheDocument();
  });

  it("submits anyway when the user insists", async () => {
    const user = await startQuiz();
    await user.click(correctRadio());
    await openSubmitDialog(user);
    await user.click(screen.getByRole("button", { name: /submit anyway/i }));

    expect(screen.getByRole("heading", { name: /quiz complete/i })).toBeInTheDocument();
    expect(screen.getByText("1 out of 3 correct")).toBeInTheDocument();
  });

  it("closes on Escape without submitting", async () => {
    const user = await startQuiz();
    await openSubmitDialog(user);

    await user.keyboard("{Escape}");

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByText("Question 1 of 3")).toBeInTheDocument();
  });

  it("does not warn when every question is answered", async () => {
    const user = await answerEveryQuestion(await startQuiz());
    const dialog = await openSubmitDialog(user);

    expect(dialog).toHaveAccessibleName(/submit your quiz/i);
    expect(within(dialog).getByText(/all 3 questions answered/i)).toBeInTheDocument();
  });
});

/** Walk the whole quiz answering each question correctly. */
async function answerEveryQuestion(user: User): Promise<User> {
  for (let step = 0; step < QUIZ.length; step++) {
    await user.click(correctRadio());
    if (step < QUIZ.length - 1) await user.click(screen.getByRole("button", { name: /next/i }));
  }
  return user;
}

describe("results and review", () => {
  async function completeAllCorrect(): Promise<User> {
    const user = await answerEveryQuestion(await startQuiz());
    const dialog = await openSubmitDialog(user);
    await user.click(within(dialog).getByRole("button", { name: /submit quiz/i }));
    return user;
  }

  it("reports raw score, percentage, and the correct/incorrect/unanswered split", async () => {
    await completeAllCorrect();

    expect(screen.getByText("3 out of 3 correct")).toBeInTheDocument();
    expect(screen.getAllByText("100%").length).toBeGreaterThan(0);

    // Each result card is a <dt>/<dd> pair: the label, then its value. The total is
    // covered by "3 out of 3 correct" above.
    const tally = (label: string) => screen.getByText(label, { selector: "dt" }).nextElementSibling;
    expect(tally("Correct")).toHaveTextContent("3");
    expect(tally("Missed")).toHaveTextContent("0");
    expect(tally("Unanswered")).toHaveTextContent("0");
    expect(tally("Accuracy")).toHaveTextContent("100%");
  });

  it("reviews every question with the user's answer and the correct answer", async () => {
    const user = await startQuiz();
    await user.click(anIncorrectRadio());
    await user.click(screen.getByRole("button", { name: /next/i }));
    await user.click(correctRadio());
    await openSubmitDialog(user);
    await user.click(screen.getByRole("button", { name: /submit anyway/i }));

    expect(screen.getByText("1 out of 3 correct")).toBeInTheDocument();
    expect(reviewItems()).toHaveLength(3);
    expect(reviewItems("correct")).toHaveLength(1);
    expect(reviewItems("incorrect")).toHaveLength(1);
    expect(reviewItems("unanswered")).toHaveLength(1);

    // The incorrect card must show both what was chosen and what was right.
    const wrongCard = reviewItems("incorrect")[0]!;
    expect(within(wrongCard).getByText("Your answer")).toBeInTheDocument();
    expect(within(wrongCard).getByText("Correct answer")).toBeInTheDocument();
    expect(within(wrongCard).getAllByRole("listitem")).toHaveLength(4);

    // The correct card marks a single row as both the selection and the answer.
    expect(
      within(reviewItems("correct")[0]!).getByText("Your answer · Correct"),
    ).toBeInTheDocument();

    // The skipped card says so in words, not only in colour.
    expect(
      within(reviewItems("unanswered")[0]!).getByText(/you did not answer this question/i),
    ).toBeInTheDocument();
  });

  it("numbers review entries by the order they were shown, not the file order", async () => {
    await completeAllCorrect();
    expect(reviewItems().map((item) => within(item).getByText(/^Question \d$/).textContent)).toEqual(
      ["Question 1", "Question 2", "Question 3"],
    );
  });

  it("shows an explanation when the source question has one", async () => {
    await completeAllCorrect();
    expect(screen.getByText("Mercury orbits nearest the Sun.")).toBeInTheDocument();
  });

  it("filters the review to incorrect or unanswered questions", async () => {
    const user = await completeAllCorrect();

    await user.click(screen.getByRole("button", { name: /^missed 0$/i }));
    expect(reviewItems()).toHaveLength(0);
    expect(screen.getByText(/you did not miss a single question/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /^all 3$/i }));
    expect(reviewItems()).toHaveLength(3);
  });
});

describe("restart", () => {
  async function submitEmpty(): Promise<User> {
    const user = await startQuiz();
    await openSubmitDialog(user);
    await user.click(screen.getByRole("button", { name: /submit anyway/i }));
    return user;
  }

  it("reshuffles into a fresh attempt with no answers carried over", async () => {
    const user = await submitEmpty();
    expect(screen.getByText("0 out of 3 correct")).toBeInTheDocument();
    expect(screen.getByText(/attempt 1/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /take it again/i }));

    expect(screen.getByText("Question 1 of 3")).toBeInTheDocument();
    expect(screen.getByText("0 answered · 3 remaining")).toBeInTheDocument();
    expect(screen.getAllByRole<HTMLInputElement>("radio").every((radio) => !radio.checked)).toBe(
      true,
    );

    // Same source file, so the new attempt still holds every question.
    await openSubmitDialog(user);
    await user.click(screen.getByRole("button", { name: /submit anyway/i }));
    expect(screen.getByText("0 out of 3 correct")).toBeInTheDocument();
    expect(screen.getByText(/attempt 2/i)).toBeInTheDocument();
    expect(reviewItems()).toHaveLength(3);
  });

  it("returns to upload and clears the previous quiz", async () => {
    const user = await submitEmpty();
    await user.click(screen.getByRole("button", { name: /^new quiz$/i }));

    expect(screen.getByRole("heading", { name: /any quiz\. any subject\./i })).toBeInTheDocument();
    expect(screen.queryByText("my-quiz.json")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /start quiz/i })).not.toBeInTheDocument();
    expect(screen.queryByText("0 out of 3 correct")).not.toBeInTheDocument();
    expect(reviewItems()).toHaveLength(0);
  });

  it("abandons an in-progress quiz from the quiz screen", async () => {
    const user = await startQuiz();
    await user.click(correctRadio());

    await user.click(screen.getByRole("button", { name: /^new quiz$/i }));

    expect(screen.getByRole("heading", { name: /any quiz\. any subject\./i })).toBeInTheDocument();
    expect(screen.queryByText("Question 1 of 3")).not.toBeInTheDocument();
  });
});

describe("accessibility scaffolding", () => {
  it("offers a skip link to the main landmark", () => {
    render(<App />);
    expect(screen.getByRole("link", { name: /skip to main content/i })).toHaveAttribute(
      "href",
      "#main",
    );
    expect(screen.getByRole("main")).toHaveAttribute("id", "main");
  });

  it("gives every screen a top-level heading", async () => {
    const user = await startQuiz();
    expect(screen.getByRole("heading", { level: 1 })).toHaveAccessibleName(
      /question 1 of 3/i,
    );

    await openSubmitDialog(user);
    await user.click(screen.getByRole("button", { name: /submit anyway/i }));
    expect(screen.getByRole("heading", { level: 1 })).toHaveAccessibleName(/quiz complete/i);
  });

  it("groups every choice under the question text", async () => {
    await startQuiz();
    const group = questionGroup();
    expect(group).toHaveAccessibleName(currentQuestionText());
    expect(within(group).getAllByRole("radio")).toHaveLength(4);
  });

  it("labels each choice with its answer text alone", async () => {
    await startQuiz();
    const question = QUIZ.find((entry) => entry.question === currentQuestionText())!;
    for (const text of [question.answer, ...question.distractors]) {
      expect(screen.getByRole("radio", { name: text })).toBeInTheDocument();
    }
  });

  it("moves focus to the question when navigating", async () => {
    const user = await startQuiz();
    await user.click(screen.getByRole("button", { name: /next/i }));
    expect(questionGroup().querySelector("legend")).toHaveFocus();
  });

  it("moves focus into the new screen instead of dropping it on submit", async () => {
    const user = await startQuiz();
    await openSubmitDialog(user);
    await user.click(screen.getByRole("button", { name: /submit anyway/i }));

    // The button that was clicked has unmounted; focus must not fall back to <body>.
    expect(screen.getByRole("main")).toHaveFocus();
  });

  it("does not steal focus on first load", () => {
    render(<App />);
    expect(document.body).toHaveFocus();
  });
});

describe("variable distractor counts", () => {
  /** One question with `count` distractors, answer text is always "right". */
  function question(count: number, label: string) {
    return {
      question: `${label} (${count} distractors)?`,
      answer: `right-${label}`,
      distractors: Array.from({ length: count }, (_, index) => `wrong-${label}-${index + 1}`),
    };
  }

  /** Read the choices currently on screen in display order. */
  function visibleChoices(): string[] {
    return screen
      .getAllByRole("radio")
      .map((radio) => radio.closest("label")?.querySelector(".choice__text")?.textContent ?? "");
  }

  /** The A./B./C. letters currently rendered, in order. */
  function visibleLetters(): string[] {
    return Array.from(document.querySelectorAll(".choice__letter")).map(
      (node) => node.textContent ?? "",
    );
  }

  it.each([
    [2, 3, ["A", "B", "C"]],
    [3, 4, ["A", "B", "C", "D"]],
    [4, 5, ["A", "B", "C", "D", "E"]],
    [5, 6, ["A", "B", "C", "D", "E", "F"]],
  ])(
    "renders %i distractors as %i choices labelled through the end of the list",
    async (count, expectedChoices, expectedLetters) => {
      await startQuiz([question(count, "q1")]);

      expect(screen.getAllByRole("radio")).toHaveLength(expectedChoices);
      expect(visibleLetters()).toEqual(expectedLetters);

      // Exactly the supplied answers, nothing invented and nothing dropped.
      expect(visibleChoices().sort()).toEqual(
        [`right-q1`, ...Array.from({ length: count }, (_, i) => `wrong-q1-${i + 1}`)].sort(),
      );
    },
  );

  it("renders each question with its own choice count in one mixed quiz", async () => {
    const mixed = [
      question(2, "two"),
      question(3, "three"),
      question(4, "four"),
      question(5, "five"),
    ];
    const user = await startQuiz(mixed);

    const seen = new Map<string, number>();
    for (let step = 0; step < mixed.length; step++) {
      const prompt = currentQuestionText();
      seen.set(prompt, screen.getAllByRole("radio").length);
      if (step < mixed.length - 1) await user.click(screen.getByRole("button", { name: /next/i }));
    }

    // Whatever order they were shuffled into, each question showed distractors + 1.
    for (const entry of mixed) {
      expect(seen.get(entry.question)).toBe(entry.distractors.length + 1);
    }
    expect(seen.size).toBe(4);
  });

  it("scores and reviews a mixed quiz correctly", async () => {
    const mixed = [question(2, "two"), question(5, "five"), question(4, "four")];
    const answers = new Map(mixed.map((entry) => [entry.question, entry.answer]));
    const user = await startQuiz(mixed);

    // Answer every question correctly, wherever it landed and however many choices it has.
    for (let step = 0; step < mixed.length; step++) {
      const correct = answers.get(currentQuestionText())!;
      await user.click(screen.getByRole("radio", { name: correct }));
      if (step < mixed.length - 1) await user.click(screen.getByRole("button", { name: /next/i }));
    }

    const dialog = await openSubmitDialog(user);
    await user.click(within(dialog).getByRole("button", { name: /submit quiz/i }));

    expect(screen.getByText("3 out of 3 correct")).toBeInTheDocument();
    expect(screen.getAllByText("100%").length).toBeGreaterThan(0);
    expect(reviewItems("correct")).toHaveLength(3);

    // Each review card lists that question's own choices, and marks one as correct.
    const cardSizes = reviewItems().map((card) => within(card).getAllByRole("listitem").length);
    expect(cardSizes.sort()).toEqual([3, 5, 6]);
    for (const card of reviewItems()) {
      expect(within(card).getByText("Your answer · Correct")).toBeInTheDocument();
    }
  });

  it("reshuffles a mixed quiz and still scores it", async () => {
    const mixed = [question(2, "two"), question(5, "five")];
    const answers = new Map(mixed.map((entry) => [entry.question, entry.answer]));
    const user = await startQuiz(mixed);

    await openSubmitDialog(user);
    await user.click(screen.getByRole("button", { name: /submit anyway/i }));
    expect(screen.getByText("0 out of 2 correct")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /take it again/i }));

    for (let step = 0; step < mixed.length; step++) {
      const prompt = currentQuestionText();
      // Choice count still matches this question after a reshuffle.
      const expected = mixed.find((entry) => entry.question === prompt)!.distractors.length + 1;
      expect(screen.getAllByRole("radio")).toHaveLength(expected);
      await user.click(screen.getByRole("radio", { name: answers.get(prompt)! }));
      if (step < mixed.length - 1) await user.click(screen.getByRole("button", { name: /next/i }));
    }

    const dialog = await openSubmitDialog(user);
    await user.click(within(dialog).getByRole("button", { name: /submit quiz/i }));
    expect(screen.getByText("2 out of 2 correct")).toBeInTheDocument();
    expect(screen.getByText(/attempt 2/i)).toBeInTheDocument();
  });

  it("reports a uniform quiz's structure on the upload screen", async () => {
    await upload(quizFile([question(3, "a"), question(3, "b")]));

    await screen.findByText("Ready to begin");
    expect(stat("Questions")).toHaveTextContent(/^2$/);
    expect(stat("Answer choices")).toHaveTextContent("4 per question");
  });

  it("reports a mixed quiz's structure as a range", async () => {
    await upload(
      quizFile([question(2, "a"), question(3, "b"), question(4, "c"), question(5, "d")]),
    );

    await screen.findByText("Ready to begin");
    expect(stat("Questions")).toHaveTextContent(/^4$/);
    expect(stat("Answer choices")).toHaveTextContent("3–6 per question");
  });

  it("rejects a question with too few distractors, naming the question", async () => {
    await upload(quizFile([question(3, "ok"), question(1, "thin")]));

    await screen.findByText(/could not be used/i);
    expect(issueTexts()).toContainEqual(expect.stringMatching(/^Question 2: Only 1 distractor supplied\. At least 2 distractors are required\./));
    expect(screen.queryByRole("button", { name: /start quiz/i })).not.toBeInTheDocument();
  });

  it("rejects a question with too many distractors, naming the question", async () => {
    await upload(quizFile([question(3, "ok"), question(3, "ok2"), question(6, "fat")]));

    await screen.findByText(/could not be used/i);
    expect(issueTexts()).toContainEqual(expect.stringMatching(/^Question 3: 6 distractors supplied\. The maximum supported number is 5\./));
    expect(screen.queryByRole("button", { name: /start quiz/i })).not.toBeInTheDocument();
  });

  it("explains the distractor terminology and the supported range on the upload page", () => {
    render(<App />);

    expect(screen.getByText(/Distractors are incorrect answer choices\./i)).toBeInTheDocument();
    expect(
      screen.getByText(/Total choices = 1 correct answer \+ distractors\./i),
    ).toBeInTheDocument();
    const formula = document.querySelector(".formula")?.textContent ?? "";
    expect(formula).toMatch(/3 distractors \+ 1 correct answer = 4 total choices/);
    expect(formula).toMatch(/recommended/i);
    // The shorter 2-distractor example proves the count is not fixed at three.
    const codeBlocks = Array.from(document.querySelectorAll("pre.code")).map(
      (node) => node.textContent ?? "",
    );
    expect(codeBlocks.some((text) => text.includes('"distractors"'))).toBe(true);
    expect(
      codeBlocks.some(
        (text) => text.includes('"3"') && text.includes('"5"') && !text.includes('"6"'),
      ),
    ).toBe(true);
  });
});

describe("redesigned screens", () => {
  it("leads with what the app does, then the upload control, then the format guide", () => {
    render(<App />);
    const heading = screen.getByRole("heading", { level: 1 });
    const upload = screen.getByLabelText(/choose a json file/i);
    const guide = screen.getByRole("heading", { name: /quiz file format/i });

    expect(heading).toHaveAccessibleName(/any quiz\. any subject\./i);
    // Document order is reading order: what it does, then upload, then the guide.
    expect(heading.compareDocumentPosition(upload) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(upload.compareDocumentPosition(guide) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("returns to the drop area when choosing a different file", async () => {
    const user = await upload(quizFile(QUIZ));
    await user.click(await screen.findByRole("button", { name: /choose a different file/i }));

    expect(screen.getByLabelText(/choose a json file/i)).toBeInTheDocument();
    expect(screen.queryByText("Ready to begin")).not.toBeInTheDocument();
  });

  it("styles every choice identically before submission, so the answer cannot be spotted", async () => {
    await startQuiz();

    const classes = Array.from(document.querySelectorAll(".choice"), (choice) => choice.className);
    expect(classes).toHaveLength(4);
    expect(new Set(classes).size).toBe(1);
    expect(screen.queryByText("Correct answer")).not.toBeInTheDocument();
  });

  it("moves focus to the review, filtered to what was missed, when Review missed questions is pressed", async () => {
    const user = await startQuiz();
    await openSubmitDialog(user);
    await user.click(screen.getByRole("button", { name: /submit anyway/i }));

    await user.click(screen.getByRole("button", { name: /review missed questions/i }));

    // Nothing was answered, so "missed" means the unanswered questions.
    const heading = screen.getByRole("heading", { name: /review unanswered questions/i });
    expect(heading).toHaveFocus();
    expect(reviewItems()).toHaveLength(3);
    expect(reviewItems("unanswered")).toHaveLength(3);
  });

  it("offers Review answers instead when nothing was missed", async () => {
    const user = await answerEveryQuestion(await startQuiz());
    const dialog = await openSubmitDialog(user);
    await user.click(within(dialog).getByRole("button", { name: /submit quiz/i }));

    expect(screen.queryByRole("button", { name: /review missed questions/i })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /review answers/i }));
    expect(screen.getByRole("heading", { name: /review every question/i })).toHaveFocus();
  });
});

describe("setup screen options", () => {
  it("defaults to a randomized, full-length quiz and reports it", async () => {
    await upload(quizFile(QUIZ));
    await screen.findByText("Ready to begin");

    expect(screen.getByRole("switch", { name: /shuffle question order/i })).toBeChecked();
    expect(stat("Order")).toHaveTextContent("Randomized");
    // Three questions is below every length preset, so there is nothing to choose.
    expect(screen.queryByRole("combobox", { name: /number of questions/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/distractor/i)).not.toBeInTheDocument();
  });

  it("keeps the file order when shuffling is switched off", async () => {
    const user = await upload(quizFile(QUIZ));
    await user.click(await screen.findByRole("switch", { name: /shuffle question order/i }));
    expect(stat("Order")).toHaveTextContent("As written");

    await user.click(screen.getByRole("button", { name: /start quiz/i }));

    for (let step = 0; step < QUIZ.length; step++) {
      expect(currentQuestionText()).toBe(QUIZ[step]!.question);
      if (step < QUIZ.length - 1) await user.click(screen.getByRole("button", { name: /next/i }));
    }
  });

  it("offers shorter lengths for a long file and builds a quiz of that length", async () => {
    const long = Array.from({ length: 12 }, (_, index) => ({
      question: `Long question ${index + 1}?`,
      answer: "right",
      distractors: ["wrong 1", "wrong 2", "wrong 3"],
    }));
    const user = await upload(quizFile(long, "long.json"));
    const length = await screen.findByRole("combobox", { name: /number of questions/i });

    expect(within(length).getAllByRole("option").map((option) => option.textContent)).toEqual([
      "All (12)",
      "5",
      "10",
    ]);

    await user.selectOptions(length, "5");
    expect(stat("Questions")).toHaveTextContent("5 of 12");

    await user.click(screen.getByRole("button", { name: /start quiz/i }));
    expect(screen.getByText("Question 1 of 5")).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuemax", "5");

    // "Take it again" keeps the same length.
    await openSubmitDialog(user);
    await user.click(screen.getByRole("button", { name: /submit anyway/i }));
    expect(screen.getByText("0 out of 5 correct")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /take it again/i }));
    expect(screen.getByText("Question 1 of 5")).toBeInTheDocument();
  });

  it("shows one progress segment per question and marks the answered ones", async () => {
    const user = await startQuiz();
    const bar = screen.getByRole("progressbar");
    expect(bar.querySelectorAll(".progress__segment")).toHaveLength(3);
    expect(bar.querySelectorAll(".progress__segment--done")).toHaveLength(0);

    await user.click(correctRadio());
    expect(bar.querySelectorAll(".progress__segment--done")).toHaveLength(1);
  });

  it("drops the Format guide link from the header while the setup screen is showing", async () => {
    const user = await upload(quizFile(QUIZ));
    await screen.findByText("Ready to begin");
    expect(screen.queryByRole("link", { name: "Format guide" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /choose a different file/i }));
    expect(screen.getByRole("link", { name: "Format guide" })).toBeInTheDocument();
  });
});
