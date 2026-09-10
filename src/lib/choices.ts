import type { SourceQuestion } from "./types";

/**
 * Answer-choice rules, labels, and quiz-shape reporting.
 *
 * Terminology used consistently across the codebase and the UI:
 *
 *  - **correct answer** — the one choice that is actually correct (`answer`)
 *  - **distractor** — an incorrect choice (`distractors[]`)
 *  - **total choices** — the correct answer plus the distractors
 *
 * A question's distractor count is whatever `distractors.length` is. There is no separate
 * count field to keep in sync, and questions within one quiz may differ from each other.
 */

/** Fewest distractors a question may supply. 2 distractors = 3 total choices. */
export const MIN_DISTRACTORS = 2;

/** Most distractors a question may supply. 5 distractors = 6 total choices. */
export const MAX_DISTRACTORS = 5;

/** The recommended default. 3 distractors = 4 total choices. */
export const RECOMMENDED_DISTRACTORS = 3;

/** Total choices when a question supplies the fewest allowed distractors. */
export const MIN_CHOICES = MIN_DISTRACTORS + 1;

/** Total choices when a question supplies the most allowed distractors. */
export const MAX_CHOICES = MAX_DISTRACTORS + 1;

/** Total choices for the recommended default. */
export const RECOMMENDED_CHOICES = RECOMMENDED_DISTRACTORS + 1;

/** Total choices a question will render: the correct answer plus its distractors. */
export function totalChoices(distractorCount: number): number {
  return distractorCount + 1;
}

/**
 * Display label for a choice at a given position: A, B, C, … Z, AA, AB, …
 *
 * The supported range only needs A–F, but the label is computed rather than read from a
 * fixed `["A","B","C","D"]` array so raising `MAX_DISTRACTORS` never silently produces
 * unlabelled choices.
 */
export function choiceLabel(index: number): string {
  if (!Number.isInteger(index) || index < 0) return "?";

  let label = "";
  let remaining = index;

  for (;;) {
    label = String.fromCharCode(65 + (remaining % 26)) + label;
    remaining = Math.floor(remaining / 26) - 1;
    if (remaining < 0) return label;
  }
}

/** The answer-choice structure of a whole quiz, for reporting it back to the user. */
export interface ChoiceShape {
  questionCount: number;
  minDistractors: number;
  maxDistractors: number;
  /** True when every question supplies the same number of distractors. */
  uniform: boolean;
}

/**
 * Summarize how a set of source questions is shaped.
 *
 * Returns `null` for an empty set — an empty quiz never reaches this code (validation
 * rejects it), and reporting "0 questions, 0 distractors" would be noise rather than
 * information.
 */
export function summarizeChoiceShape(questions: readonly SourceQuestion[]): ChoiceShape | null {
  if (questions.length === 0) return null;

  const counts = questions.map((question) => question.distractors.length);
  const minDistractors = Math.min(...counts);
  const maxDistractors = Math.max(...counts);

  return {
    questionCount: questions.length,
    minDistractors,
    maxDistractors,
    uniform: minDistractors === maxDistractors,
  };
}

/** Human-readable lines describing a quiz's answer-choice structure. */
export interface ChoiceShapeLabels {
  questions: string;
  distractors: string;
  choices: string;
}

/**
 * Render a shape as the lines shown on the upload screen.
 *
 * Uniform: "3 distractors per question" / "4 total choices per question".
 * Mixed:   "2–5 distractors per question" / "3–6 total choices".
 */
export function describeChoiceShape(shape: ChoiceShape): ChoiceShapeLabels {
  const questions = `${shape.questionCount} question${shape.questionCount === 1 ? "" : "s"}`;

  if (shape.uniform) {
    return {
      questions,
      distractors: `${shape.minDistractors} distractors per question`,
      choices: `${totalChoices(shape.minDistractors)} total choices per question`,
    };
  }

  return {
    questions,
    distractors: `${shape.minDistractors}–${shape.maxDistractors} distractors per question`,
    choices: `${totalChoices(shape.minDistractors)}–${totalChoices(shape.maxDistractors)} total choices`,
  };
}
