/**
 * Core quiz types.
 *
 * Two distinct shapes live here and they are deliberately kept apart:
 *
 *  - `SourceQuestion` is what the user's JSON file contains. It is treated as immutable
 *    input for the whole life of the session — nothing shuffles, grades, or rewrites it.
 *  - `AttemptQuestion` is one question inside one randomized attempt. Building an attempt
 *    copies from the source; taking the quiz again builds a fresh attempt from the same
 *    untouched source.
 *
 * Answers are recorded against `AttemptQuestion.id`, never against a position in an
 * array. That is what makes question-order randomization safe: the displayed order can
 * be anything at all and grading is unaffected.
 */

/** A single question exactly as it appears in an uploaded JSON file. */
export interface SourceQuestion {
  question: string;
  answer: string;
  /** Exactly three incorrect choices. */
  distractors: string[];
  /** Optional. Shown on the review screen after submission when present. */
  explanation?: string;
}

/** One of the four selectable choices shown for a question. */
export interface AttemptChoice {
  /**
   * Position-derived id, assigned *after* the choices are shuffled, so the id itself
   * never hints at which choice is the correct one.
   */
  id: string;
  text: string;
}

/** One question inside one randomized attempt. */
export interface AttemptQuestion {
  /** Stable within an attempt; regenerated on every reshuffle. */
  id: string;
  /**
   * Index of this question in the uploaded source array. Kept for internal integrity
   * checks and tests only — it is never rendered, so the original question number is
   * not revealed during the quiz.
   */
  sourceIndex: number;
  prompt: string;
  /** Always exactly four, in randomized display order. */
  choices: AttemptChoice[];
  /** The id of the choice in `choices` whose text is the correct answer. */
  correctChoiceId: string;
  explanation?: string;
}

/** A randomized, in-memory quiz generated from the source questions. */
export interface QuizAttempt {
  /** Increments per attempt so React remounts cleanly on a reshuffle. */
  attemptNumber: number;
  questions: AttemptQuestion[];
}

/** questionId -> selected choiceId. Absent key means unanswered. */
export type Selections = Record<string, string>;

export type ReviewOutcome = "correct" | "incorrect" | "unanswered";

export interface ReviewEntry {
  questionId: string;
  /** 1-based position in *this attempt*, which is what the learner actually saw. */
  displayNumber: number;
  prompt: string;
  choices: AttemptChoice[];
  outcome: ReviewOutcome;
  selectedChoiceId: string | null;
  selectedText: string | null;
  correctChoiceId: string;
  correctText: string;
  explanation?: string;
}

export interface QuizResult {
  total: number;
  correct: number;
  incorrect: number;
  unanswered: number;
  /** 0–100, rounded to one decimal place. */
  percent: number;
  entries: ReviewEntry[];
}
