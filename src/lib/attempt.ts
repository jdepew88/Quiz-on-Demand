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
 * Setup-screen choices that shape an attempt. Every field is optional and the defaults are
 * the app's original behaviour: every question, in a fresh random order.
 */
export interface AttemptOptions {
  /** `false` keeps the file's question order. Default `true`. */
  shuffleQuestions?: boolean;
  /**
   * Keep only this many questions (taken from the front of the shuffled order, so a short
   * attempt is a random sample). Ignored unless it is a positive integer smaller than the
   * source length.
   */
  limit?: number;
}

/** True when `limit` is a real, shortening limit for a quiz of `total` questions. */
export function isQuestionLimit(limit: number | undefined, total: number): limit is number {
  return limit !== undefined && Number.isInteger(limit) && limit > 0 && limit < total;
}

/**
 * Build one randomized attempt from the uploaded source questions.
 *
 * Two independent shuffles happen here (the first can be switched off via `options`; the
 * second cannot — the file format stores the answer separately from the distractors, so an
 * "unshuffled" choice order would put the correct answer first every time):
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
 *
 * The choice count is whatever the question supplies: every distractor is rendered and
 * none is invented, so a question always shows `distractors.length + 1` choices. Nothing
 * here truncates a long list or pads a short one, and questions within one attempt may
 * have different counts.
 */
export function buildAttempt(
  source: readonly SourceQuestion[],
  attemptNumber: number,
  rng: RandomSource = Math.random,
  options: AttemptOptions = {},
): QuizAttempt {
  const indexed = source.map((question, sourceIndex) => ({ question, sourceIndex }));
  const ordered = options.shuffleQuestions === false ? indexed : shuffle(indexed, rng);
  const order = isQuestionLimit(options.limit, source.length)
    ? ordered.slice(0, options.limit)
    : ordered;

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
    // Exactly one entry above is flagged correct, whatever the choice count, so this
    // cannot miss. Guarding anyway keeps the type honest without a non-null assertion.
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
