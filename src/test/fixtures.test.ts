import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { formatIssue, parseQuizFile } from "../lib/validation";
import { MAX_CHOICES, MIN_CHOICES, summarizeChoiceShape } from "../lib/choices";
import { EXAMPLE_JSON } from "../components/FormatGuide";
import { buildAttempt, gradeAttempt } from "../lib/attempt";

/**
 * The files we hand people have to be valid input to our own validator.
 *
 * Without this, a typo in `public/sample-quiz.json` or in the on-page example would ship
 * as a broken template and only surface when somebody downloaded it and got an error.
 */

// Vitest runs with the project root as the working directory, so this reads the same
// files that `vite build` copies into `dist/` and Cloudflare then serves.
function readPublic(name: string): string {
  return readFileSync(resolve(process.cwd(), "public", name), "utf8");
}

describe.each([
  ["public/sample-quiz.json", () => readPublic("sample-quiz.json")],
  ["public/quiz-template.json", () => readPublic("quiz-template.json")],
  ["the example shown on the upload page", () => EXAMPLE_JSON],
])("%s", (_label, read) => {
  it("passes validation", () => {
    const result = parseQuizFile(read());
    if (!result.ok) {
      throw new Error(`Shipped quiz file is invalid:\n${result.issues.map(formatIssue).join("\n")}`);
    }
    expect(result.questions.length).toBeGreaterThan(0);
  });

  it("can be turned into a playable, gradeable attempt", () => {
    const result = parseQuizFile(read());
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const attempt = buildAttempt(result.questions, 1);
    expect(attempt.questions).toHaveLength(result.questions.length);

    // Each question renders its own answer plus its own distractors — no fixed count.
    for (const question of attempt.questions) {
      const original = result.questions[question.sourceIndex]!;
      expect(question.choices).toHaveLength(original.distractors.length + 1);
      expect(question.choices.length).toBeGreaterThanOrEqual(MIN_CHOICES);
      expect(question.choices.length).toBeLessThanOrEqual(MAX_CHOICES);
    }

    const perfect = gradeAttempt(
      attempt,
      Object.fromEntries(attempt.questions.map((q) => [q.id, q.correctChoiceId])),
    );
    expect(perfect.percent).toBe(100);
    expect(perfect.correct).toBe(result.questions.length);
  });
});

describe("public/sample-quiz.json", () => {
  it("has enough questions to make randomization visible", () => {
    const result = parseQuizFile(readPublic("sample-quiz.json"));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.questions.length).toBeGreaterThanOrEqual(10);
  });

  it("exercises more than one distractor count, so the sample demonstrates the range", () => {
    const result = parseQuizFile(readPublic("sample-quiz.json"));
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const shape = summarizeChoiceShape(result.questions)!;
    expect(shape.uniform).toBe(false);
    expect(shape.minDistractors).toBe(2);
    expect(shape.maxDistractors).toBe(5);
  });

  it("still uses the recommended 3 distractors for most questions", () => {
    const result = parseQuizFile(readPublic("sample-quiz.json"));
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const threes = result.questions.filter((q) => q.distractors.length === 3).length;
    expect(threes).toBeGreaterThan(result.questions.length / 2);
  });
});

describe("public/quiz-template.json", () => {
  it("leads with the recommended 3-distractor shape", () => {
    const result = parseQuizFile(readPublic("quiz-template.json"));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.questions[0]?.distractors).toHaveLength(3);
  });

  it("also demonstrates a different count", () => {
    const result = parseQuizFile(readPublic("quiz-template.json"));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(summarizeChoiceShape(result.questions)?.uniform).toBe(false);
  });
});
