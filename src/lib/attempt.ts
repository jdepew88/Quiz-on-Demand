import { shuffle, type RandomSource } from "./shuffle";
import type {
  AttemptChoice,
  AttemptQuestion,
  QuizAttempt,
  QuizResult,
  ReviewEntry,
  ReviewOutcome,
  Selections,
  SourceQuestion,
} from "./types";

/**
 * Attempt construction and grading.
 *
 * Both functions are pure and operate only on what they are handed — the source questions
 * are read, never written, so "Take again / Reshuffle" is just another call to
 * `buildAttempt` with the same array.
 */

/**
 * Build one randomized attempt from the uploaded source questions.
 *
 * Two independent shuffles happen here:
 *
 *  1. **Question order** (the primary requirement). The attempt's questions are a
 *     Fisher-Yates permutation of the source array.
 *  2. **Choice order** within each question, so the correct answer does not sit in the
 *     same slot every time. Adapted from the option-shuffling used by the source repo's
 *     interactive question components.
 *
 * Correctness survives both because grading is keyed on ids, not positions:
 * `correctChoiceId` is resolved *after* the choices are shuffled, by finding where the
 * correct text actually landed.
 */
export function buildAttempt(
  source: readonly SourceQuestion[],
  attemptNumber: number,
  rng: RandomSource = Math.random,
): QuizAttempt {
  const order = shuffle(
    source.map((question, sourceIndex) => ({ question, sourceIndex })),
    rng,
  );

  const questions: AttemptQuestion[] = order.map(({ question, sourceIndex }, position) => {
    const id = `a${attemptNumber}-q${position}`;

    // Shuffle first, then label. Ids are derived from the *shuffled* position, so an id
    // can never be used to work out which choice is correct.
    const shuffledChoices = shuffle(
      [
        { text: question.answer, isCorrect: true },
        ...question.distractors.map((text) => ({ text, isCorrect: false })),
      ],
      rng,
    );

    const choices: AttemptChoice[] = shuffledChoices.map((choice, choiceIndex) => ({
      id: `${id}-c${choiceIndex}`,
      text: choice.text,
    }));

    const correctIndex = shuffledChoices.findIndex((choice) => choice.isCorrect);
    // The correct answer is always one of the four entries above, so this cannot miss.
    // Guarding anyway keeps the type honest without a non-null assertion.
    const correctChoice = choices[correctIndex === -1 ? 0 : correctIndex];

    const built: AttemptQuestion = {
      id,
      sourceIndex,
      prompt: question.question,
      choices,
      correctChoiceId: correctChoice ? correctChoice.id : `${id}-c0`,
    };

    return question.explanation === undefined
      ? built
      : { ...built, explanation: question.explanation };
  });

  return { attemptNumber, questions };
}

/** Percentage correct, 0–100, rounded to one decimal place. */
export function computePercent(correct: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((correct / total) * 1000) / 10;
}

/** Drop a trailing ".0" so a clean score reads "84%" rather than "84.0%". */
export function formatPercent(percent: number): string {
  return `${Number.isInteger(percent) ? percent : percent.toFixed(1)}%`;
}

/** How many questions in the attempt have a selection recorded. */
export function countAnswered(attempt: QuizAttempt, selections: Selections): number {
  return attempt.questions.filter((question) => Boolean(selections[question.id])).length;
}

/** Ids of questions with no selection, in display order. */
export function unansweredQuestions(attempt: QuizAttempt, selections: Selections): AttemptQuestion[] {
  return attempt.questions.filter((question) => !selections[question.id]);
}

/**
 * Grade an attempt.
 *
 * A selection that does not correspond to a real choice on that question (which should be
 * unreachable from the UI) is treated as unanswered rather than as a wrong answer, so a
 * corrupt selection can never be scored as an attempt the learner did not make.
 */
export function gradeAttempt(attempt: QuizAttempt, selections: Selections): QuizResult {
  const entries: ReviewEntry[] = attempt.questions.map((question, index) => {
    const selectedChoiceId = selections[question.id] ?? null;
    const selectedChoice =
      selectedChoiceId === null
        ? undefined
        : question.choices.find((choice) => choice.id === selectedChoiceId);

    const correctChoice = question.choices.find((choice) => choice.id === question.correctChoiceId);

    const outcome: ReviewOutcome = !selectedChoice
      ? "unanswered"
      : selectedChoice.id === question.correctChoiceId
        ? "correct"
        : "incorrect";

    const entry: ReviewEntry = {
      questionId: question.id,
      displayNumber: index + 1,
      prompt: question.prompt,
      choices: question.choices,
      outcome,
      selectedChoiceId: selectedChoice ? selectedChoice.id : null,
      selectedText: selectedChoice ? selectedChoice.text : null,
      correctChoiceId: question.correctChoiceId,
      correctText: correctChoice ? correctChoice.text : "",
    };

    return question.explanation === undefined
      ? entry
      : { ...entry, explanation: question.explanation };
  });

  const correct = entries.filter((entry) => entry.outcome === "correct").length;
  const incorrect = entries.filter((entry) => entry.outcome === "incorrect").length;
  const unanswered = entries.filter((entry) => entry.outcome === "unanswered").length;

  return {
    total: entries.length,
    correct,
    incorrect,
    unanswered,
    percent: computePercent(correct, entries.length),
    entries,
  };
}
