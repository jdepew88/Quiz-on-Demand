import type { SourceQuestion } from "./types";

/**
 * Quiz file validation.
 *
 * Design rule taken straight from the brief: nothing is silently discarded. A file either
 * validates whole or the quiz does not start, and every problem found is reported with the
 * question number it belongs to so the author can fix the file rather than guess.
 *
 * All issues are collected rather than throwing on the first one — a file with eight bad
 * questions should produce eight fixable messages in one pass.
 */

/** Every question needs exactly one correct answer and exactly this many distractors. */
export const REQUIRED_DISTRACTORS = 3;

/** 1 correct answer + 3 distractors. */
export const CHOICES_PER_QUESTION = REQUIRED_DISTRACTORS + 1;

export interface ValidationIssue {
  /** 1-based position in the uploaded array. `null` for whole-file problems. */
  questionNumber: number | null;
  /** The offending property, when the problem is attributable to one. */
  field?: "question" | "answer" | "distractors";
  message: string;
}

export type ValidationResult =
  | { ok: true; questions: SourceQuestion[] }
  | { ok: false; issues: ValidationIssue[] };

/** Case- and whitespace-insensitive comparison key for duplicate detection. */
function normalizeForComparison(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonBlankString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

/** Human-readable name for whatever the caller actually supplied. */
function describeType(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return "an array";
  if (typeof value === "string") return "a string";
  if (typeof value === "number") return "a number";
  if (typeof value === "boolean") return "a boolean";
  if (typeof value === "object") return "an object";
  return typeof value;
}

/** Truncate quoted user text so one runaway value cannot swamp the error list. */
function quote(value: string, max = 60): string {
  const collapsed = value.trim().replace(/\s+/g, " ");
  return collapsed.length > max ? `"${collapsed.slice(0, max)}..."` : `"${collapsed}"`;
}

/**
 * Validate already-parsed JSON data.
 *
 * Split from `parseQuizFile` so tests and callers that already hold a value can validate
 * it without round-tripping through a string.
 */
export function validateQuizData(data: unknown): ValidationResult {
  const issues: ValidationIssue[] = [];

  if (!Array.isArray(data)) {
    return {
      ok: false,
      issues: [
        {
          questionNumber: null,
          message:
            `The file must contain a JSON array of questions at the top level, but it contains ` +
            `${describeType(data)}. Wrap your questions in square brackets: [ { ... }, { ... } ]`,
        },
      ],
    };
  }

  if (data.length === 0) {
    return {
      ok: false,
      issues: [
        {
          questionNumber: null,
          message: "The file contains an empty array - there are no questions to run.",
        },
      ],
    };
  }

  const questions: SourceQuestion[] = [];

  data.forEach((raw, index) => {
    const questionNumber = index + 1;
    const add = (message: string, field?: ValidationIssue["field"]) => {
      issues.push(field ? { questionNumber, field, message } : { questionNumber, message });
    };

    if (!isPlainObject(raw)) {
      add(
        `Expected an object with "question", "answer", and "distractors", but found ${describeType(raw)}.`,
      );
      return;
    }

    // --- question -------------------------------------------------------------------
    let prompt = "";
    if (!("question" in raw)) {
      add('Missing the required "question" property.', "question");
    } else if (typeof raw.question !== "string") {
      add(`"question" must be a string, but it is ${describeType(raw.question)}.`, "question");
    } else if (!isNonBlankString(raw.question)) {
      add('"question" is blank.', "question");
    } else {
      prompt = raw.question.trim();
    }

    // --- answer ---------------------------------------------------------------------
    let answer = "";
    if (!("answer" in raw)) {
      add('Missing the required "answer" property.', "answer");
    } else if (typeof raw.answer !== "string") {
      add(`"answer" must be a string, but it is ${describeType(raw.answer)}.`, "answer");
    } else if (!isNonBlankString(raw.answer)) {
      add('"answer" is blank.', "answer");
    } else {
      answer = raw.answer.trim();
    }

    // --- distractors ----------------------------------------------------------------
    const distractors: string[] = [];
    let distractorsUsable = false;

    if (!("distractors" in raw)) {
      add('Missing the required "distractors" property.', "distractors");
    } else if (!Array.isArray(raw.distractors)) {
      add(
        `"distractors" must be an array of ${REQUIRED_DISTRACTORS} strings, but it is ` +
          `${describeType(raw.distractors)}.`,
        "distractors",
      );
    } else if (raw.distractors.length !== REQUIRED_DISTRACTORS) {
      add(
        `"distractors" must contain exactly ${REQUIRED_DISTRACTORS} choices, but it contains ` +
          `${raw.distractors.length}.`,
        "distractors",
      );
    } else {
      distractorsUsable = true;
      raw.distractors.forEach((entry, entryIndex) => {
        const position = entryIndex + 1;
        if (typeof entry !== "string") {
          add(
            `Distractor ${position} must be a string, but it is ${describeType(entry)}.`,
            "distractors",
          );
          distractorsUsable = false;
        } else if (!isNonBlankString(entry)) {
          add(`Distractor ${position} is blank.`, "distractors");
          distractorsUsable = false;
        } else {
          distractors.push(entry.trim());
        }
      });
    }

    // --- cross-field uniqueness -----------------------------------------------------
    // Only meaningful once the individual values are known-good, otherwise a missing
    // answer would also report as a spurious "duplicate".
    if (distractorsUsable && distractors.length === REQUIRED_DISTRACTORS) {
      const seen = new Map<string, number>();
      distractors.forEach((text, entryIndex) => {
        const key = normalizeForComparison(text);
        const firstAt = seen.get(key);
        if (firstAt !== undefined) {
          add(
            `Distractors ${firstAt + 1} and ${entryIndex + 1} are the same choice (${quote(text)}). ` +
              `All four choices must be different.`,
            "distractors",
          );
        } else {
          seen.set(key, entryIndex);
        }
      });

      if (answer) {
        const answerKey = normalizeForComparison(answer);
        const clash = distractors.findIndex((text) => normalizeForComparison(text) === answerKey);
        if (clash !== -1) {
          add(
            `The correct answer (${quote(answer)}) also appears as distractor ${clash + 1}. ` +
              `A distractor must be an incorrect choice.`,
            "distractors",
          );
        }
      }
    }

    // Only questions with no issues of their own are collected. If any issue was raised
    // anywhere in the file the whole result is rejected below, so this list is only ever
    // used on the fully-clean path.
    if (prompt && answer && distractorsUsable && distractors.length === REQUIRED_DISTRACTORS) {
      const explanation =
        typeof raw.explanation === "string" && raw.explanation.trim().length > 0
          ? raw.explanation.trim()
          : undefined;

      questions.push(
        explanation === undefined
          ? { question: prompt, answer, distractors }
          : { question: prompt, answer, distractors, explanation },
      );
    }
  });

  if (issues.length > 0) return { ok: false, issues };

  return { ok: true, questions };
}

/**
 * Parse raw file text and validate it.
 *
 * JSON syntax errors are reported with the parser's own message, which usually names the
 * character position — far more useful for fixing a hand-edited file than "invalid JSON".
 */
export function parseQuizFile(text: string): ValidationResult {
  if (text.trim().length === 0) {
    return {
      ok: false,
      issues: [{ questionNumber: null, message: "The file is empty." }],
    };
  }

  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return {
      ok: false,
      issues: [{ questionNumber: null, message: `The file is not valid JSON. ${detail}` }],
    };
  }

  return validateQuizData(data);
}

/** One-line label for an issue, e.g. `Question 4: "answer" is blank.` */
export function formatIssue(issue: ValidationIssue): string {
  return issue.questionNumber === null
    ? issue.message
    : `Question ${issue.questionNumber}: ${issue.message}`;
}
