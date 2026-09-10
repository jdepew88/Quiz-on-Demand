import { describe, expect, it } from "vitest";
import {
  buildAttempt,
  computePercent,
  countAnswered,
  formatPercent,
  gradeAttempt,
  unansweredQuestions,
} from "./attempt";
import type { QuizAttempt, Selections, SourceQuestion } from "./types";

function makeSource(count: number): SourceQuestion[] {
  return Array.from({ length: count }, (_, index) => ({
    question: `Question ${index + 1}?`,
    answer: `correct-${index + 1}`,
    distractors: [`wrong-a-${index + 1}`, `wrong-b-${index + 1}`, `wrong-c-${index + 1}`],
  }));
}

/** Answer every question correctly by looking the correct choice up by id. */
function answerAll(attempt: QuizAttempt): Selections {
  return Object.fromEntries(
    attempt.questions.map((question) => [question.id, question.correctChoiceId]),
  );
}

/** Answer every question with a deliberately wrong choice. */
function answerAllWrong(attempt: QuizAttempt): Selections {
  return Object.fromEntries(
    attempt.questions.map((question) => [
      question.id,
      question.choices.find((choice) => choice.id !== question.correctChoiceId)?.id ?? "",
    ]),
  );
}

describe("buildAttempt", () => {
  it("includes every source question exactly once", () => {
    const source = makeSource(30);
    const attempt = buildAttempt(source, 1);

    expect(attempt.questions).toHaveLength(30);
    expect([...new Set(attempt.questions.map((q) => q.sourceIndex))].sort((a, b) => a - b)).toEqual(
      source.map((_, index) => index),
    );
  });

  it("does not modify the source questions", () => {
    const source = makeSource(12);
    const snapshot = structuredClone(source);

    buildAttempt(source, 1);
    buildAttempt(source, 2);
    buildAttempt(source, 3);

    expect(source).toEqual(snapshot);
  });

  it("randomizes question order rather than keeping the source order", () => {
    // A 40-question source has 40! orderings; the source order surviving all ten builds
    // would mean the shuffle is not running at all.
    const source = makeSource(40);
    const sourceOrder = source.map((_, index) => index);

    const anyReordered = Array.from({ length: 10 }, (_, run) =>
      buildAttempt(source, run + 1).questions.map((q) => q.sourceIndex),
    ).some((order) => order.join(",") !== sourceOrder.join(","));

    expect(anyReordered).toBe(true);
  });

  it("gives every question exactly four choices: the answer plus three distractors", () => {
    const source = makeSource(15);
    const attempt = buildAttempt(source, 1);

    for (const question of attempt.questions) {
      const original = source[question.sourceIndex];
      expect(question.choices).toHaveLength(4);
      expect(new Set(question.choices.map((c) => c.text)).size).toBe(4);
      expect(question.choices.map((c) => c.text).sort()).toEqual(
        [original!.answer, ...original!.distractors].sort(),
      );
    }
  });

  it("keeps correctChoiceId pointing at the correct answer text after shuffling choices", () => {
    const source = makeSource(50);
    const attempt = buildAttempt(source, 1);

    for (const question of attempt.questions) {
      const correct = question.choices.find((choice) => choice.id === question.correctChoiceId);
      expect(correct?.text).toBe(source[question.sourceIndex]!.answer);
    }
  });

  it("shuffles answer choices so the correct answer is not always in the same slot", () => {
    const source = makeSource(1);
    const positions = new Set<number>();

    for (let run = 0; run < 200; run++) {
      const attempt = buildAttempt(source, run + 1);
      const question = attempt.questions[0]!;
      positions.add(question.choices.findIndex((c) => c.id === question.correctChoiceId));
    }

    expect([...positions].sort()).toEqual([0, 1, 2, 3]);
  });

  it("derives choice ids from the shuffled position, so an id cannot reveal the answer", () => {
    const source = makeSource(1);
    const correctSuffixes = new Set<string>();

    for (let run = 0; run < 100; run++) {
      const question = buildAttempt(source, run + 1).questions[0]!;
      correctSuffixes.add(question.correctChoiceId.split("-").pop()!);
      // Ids are always the four positional slots regardless of which one is correct.
      expect(question.choices.map((c) => c.id.split("-").pop())).toEqual(["c0", "c1", "c2", "c3"]);
    }

    expect(correctSuffixes.size).toBeGreaterThan(1);
  });

  it("gives every question in an attempt a unique id", () => {
    const attempt = buildAttempt(makeSource(100), 1);
    expect(new Set(attempt.questions.map((q) => q.id)).size).toBe(100);
  });

  it("carries an optional explanation through to the attempt", () => {
    const attempt = buildAttempt(
      [
        {
          question: "q?",
          answer: "right",
          distractors: ["a", "b", "c"],
          explanation: "because",
        },
      ],
      1,
    );

    expect(attempt.questions[0]?.explanation).toBe("because");
  });

  it("omits explanation when the source has none", () => {
    const attempt = buildAttempt(makeSource(1), 1);
    expect(attempt.questions[0]).not.toHaveProperty("explanation");
  });

  it("handles a single-question quiz", () => {
    const attempt = buildAttempt(makeSource(1), 1);
    expect(attempt.questions).toHaveLength(1);
    expect(attempt.questions[0]?.choices).toHaveLength(4);
  });
});

describe("reshuffling a new attempt", () => {
  it("produces a different question order across attempts from the same source", () => {
    const source = makeSource(40);
    const first = buildAttempt(source, 1).questions.map((q) => q.sourceIndex).join(",");

    const orders = Array.from({ length: 10 }, (_, run) =>
      buildAttempt(source, run + 2)
        .questions.map((q) => q.sourceIndex)
        .join(","),
    );

    expect(orders.some((order) => order !== first)).toBe(true);
  });

  it("stamps the attempt number and re-keys question ids so old selections cannot apply", () => {
    const source = makeSource(5);
    const first = buildAttempt(source, 1);
    const second = buildAttempt(source, 2);

    expect(first.attemptNumber).toBe(1);
    expect(second.attemptNumber).toBe(2);

    const firstIds = new Set(first.questions.map((q) => q.id));
    for (const question of second.questions) {
      expect(firstIds.has(question.id)).toBe(false);
    }
  });

  it("still grades a fresh attempt correctly after several reshuffles", () => {
    const source = makeSource(20);
    let attempt = buildAttempt(source, 1);

    for (let round = 2; round <= 6; round++) {
      attempt = buildAttempt(source, round);
      const result = gradeAttempt(attempt, answerAll(attempt));
      expect(result.correct).toBe(20);
      expect(result.percent).toBe(100);
    }
  });
});

describe("gradeAttempt", () => {
  it("scores a perfect attempt", () => {
    const attempt = buildAttempt(makeSource(50), 1);
    const result = gradeAttempt(attempt, answerAll(attempt));

    expect(result).toMatchObject({
      total: 50,
      correct: 50,
      incorrect: 0,
      unanswered: 0,
      percent: 100,
    });
  });

  it("scores an entirely wrong attempt", () => {
    const attempt = buildAttempt(makeSource(10), 1);
    const result = gradeAttempt(attempt, answerAllWrong(attempt));

    expect(result).toMatchObject({ correct: 0, incorrect: 10, unanswered: 0, percent: 0 });
  });

  it("produces the worked example: 42 / 50 is 84%", () => {
    const attempt = buildAttempt(makeSource(50), 1);
    const selections = answerAllWrong(attempt);

    attempt.questions.slice(0, 42).forEach((question) => {
      selections[question.id] = question.correctChoiceId;
    });

    const result = gradeAttempt(attempt, selections);
    expect(result.correct).toBe(42);
    expect(result.total).toBe(50);
    expect(result.percent).toBe(84);
    expect(formatPercent(result.percent)).toBe("84%");
  });

  it("scores questions correctly regardless of their position in the attempt", () => {
    const source = makeSource(25);
    const attempt = buildAttempt(source, 1);

    // Answer only the questions that came from odd source indexes, wherever they landed.
    const selections: Selections = {};
    for (const question of attempt.questions) {
      if (question.sourceIndex % 2 === 1) selections[question.id] = question.correctChoiceId;
    }

    const result = gradeAttempt(attempt, selections);
    expect(result.correct).toBe(12); // source indexes 1,3,…,23
    expect(result.unanswered).toBe(13);

    for (const entry of result.entries) {
      const question = attempt.questions.find((q) => q.id === entry.questionId)!;
      const expected = question.sourceIndex % 2 === 1 ? "correct" : "unanswered";
      expect(entry.outcome).toBe(expected);
    }
  });

  it("counts missing selections as unanswered, not incorrect", () => {
    const attempt = buildAttempt(makeSource(8), 1);
    const selections: Selections = {
      [attempt.questions[0]!.id]: attempt.questions[0]!.correctChoiceId,
      [attempt.questions[1]!.id]: attempt.questions[1]!.choices.find(
        (c) => c.id !== attempt.questions[1]!.correctChoiceId,
      )!.id,
    };

    const result = gradeAttempt(attempt, selections);
    expect(result).toMatchObject({ correct: 1, incorrect: 1, unanswered: 6, total: 8 });
    expect(result.percent).toBe(12.5);
  });

  it("treats a selection that is not one of the question's choices as unanswered", () => {
    const attempt = buildAttempt(makeSource(3), 1);
    const selections: Selections = { [attempt.questions[0]!.id]: "not-a-real-choice" };

    const result = gradeAttempt(attempt, selections);
    expect(result.unanswered).toBe(3);
    expect(result.incorrect).toBe(0);
    expect(result.entries[0]?.selectedChoiceId).toBeNull();
  });

  it("ignores selections belonging to a previous attempt", () => {
    const source = makeSource(6);
    const first = buildAttempt(source, 1);
    const stale = answerAll(first);

    const second = buildAttempt(source, 2);
    const result = gradeAttempt(second, stale);

    expect(result.unanswered).toBe(6);
    expect(result.correct).toBe(0);
  });

  it("builds review entries in display order with both answers resolved", () => {
    const attempt = buildAttempt(makeSource(4), 1);
    const selections = answerAllWrong(attempt);
    selections[attempt.questions[1]!.id] = attempt.questions[1]!.correctChoiceId;
    delete selections[attempt.questions[3]!.id];

    const result = gradeAttempt(attempt, selections);

    expect(result.entries.map((entry) => entry.displayNumber)).toEqual([1, 2, 3, 4]);
    expect(result.entries.map((entry) => entry.outcome)).toEqual([
      "incorrect",
      "correct",
      "incorrect",
      "unanswered",
    ]);

    const [first, second, , fourth] = result.entries;
    expect(first?.selectedText).not.toBe(first?.correctText);
    expect(second?.selectedText).toBe(second?.correctText);
    expect(fourth?.selectedText).toBeNull();
    expect(fourth?.correctText).toBe(
      makeSource(4)[attempt.questions[3]!.sourceIndex]!.answer,
    );
    expect(result.entries.every((entry) => entry.choices.length === 4)).toBe(true);
  });

  it("does not reveal the source question number in review entries", () => {
    const attempt = buildAttempt(makeSource(10), 1);
    const result = gradeAttempt(attempt, {});
    expect(result.entries[0]).not.toHaveProperty("sourceIndex");
  });
});

describe("answered counts", () => {
  it("counts answered questions and lists the unanswered ones in display order", () => {
    const attempt = buildAttempt(makeSource(5), 1);
    const selections: Selections = {
      [attempt.questions[1]!.id]: attempt.questions[1]!.choices[0]!.id,
      [attempt.questions[3]!.id]: attempt.questions[3]!.choices[2]!.id,
    };

    expect(countAnswered(attempt, selections)).toBe(2);
    expect(unansweredQuestions(attempt, selections).map((q) => q.id)).toEqual([
      attempt.questions[0]!.id,
      attempt.questions[2]!.id,
      attempt.questions[4]!.id,
    ]);
  });

  it("counts nothing for an untouched attempt", () => {
    const attempt = buildAttempt(makeSource(7), 1);
    expect(countAnswered(attempt, {})).toBe(0);
    expect(unansweredQuestions(attempt, {})).toHaveLength(7);
  });
});

describe("percentages", () => {
  it("rounds to one decimal place", () => {
    expect(computePercent(1, 3)).toBe(33.3);
    expect(computePercent(2, 3)).toBe(66.7);
    expect(computePercent(42, 50)).toBe(84);
    expect(computePercent(7, 8)).toBe(87.5);
  });

  it("returns 0 for an empty quiz rather than NaN", () => {
    expect(computePercent(0, 0)).toBe(0);
  });

  it("drops a trailing .0 when formatting", () => {
    expect(formatPercent(84)).toBe("84%");
    expect(formatPercent(33.3)).toBe("33.3%");
    expect(formatPercent(100)).toBe("100%");
  });
});
