import { describe, expect, it } from "vitest";
import {
  choiceLabel,
  describeChoiceShape,
  MAX_CHOICES,
  MAX_DISTRACTORS,
  MIN_CHOICES,
  MIN_DISTRACTORS,
  RECOMMENDED_CHOICES,
  RECOMMENDED_DISTRACTORS,
  summarizeChoiceShape,
  totalChoices,
} from "./choices";
import type { SourceQuestion } from "./types";

function withDistractors(count: number): SourceQuestion {
  return {
    question: `q with ${count}?`,
    answer: "right",
    distractors: Array.from({ length: count }, (_, index) => `wrong-${index + 1}`),
  };
}

describe("supported range", () => {
  it("supports 2 to 5 distractors, which is 3 to 6 total choices", () => {
    expect(MIN_DISTRACTORS).toBe(2);
    expect(MAX_DISTRACTORS).toBe(5);
    expect(MIN_CHOICES).toBe(3);
    expect(MAX_CHOICES).toBe(6);
  });

  it("keeps 3 distractors / 4 total choices as the recommended default", () => {
    expect(RECOMMENDED_DISTRACTORS).toBe(3);
    expect(RECOMMENDED_CHOICES).toBe(4);
    expect(RECOMMENDED_DISTRACTORS).toBeGreaterThanOrEqual(MIN_DISTRACTORS);
    expect(RECOMMENDED_DISTRACTORS).toBeLessThanOrEqual(MAX_DISTRACTORS);
  });

  it.each([
    [2, 3],
    [3, 4],
    [4, 5],
    [5, 6],
  ])("%i distractors is %i total choices", (distractors, choices) => {
    expect(totalChoices(distractors)).toBe(choices);
  });
});

describe("choiceLabel", () => {
  it("labels the first six positions A to F", () => {
    expect([0, 1, 2, 3, 4, 5].map(choiceLabel)).toEqual(["A", "B", "C", "D", "E", "F"]);
  });

  it("covers the whole alphabet and keeps going past it", () => {
    expect(choiceLabel(25)).toBe("Z");
    expect(choiceLabel(26)).toBe("AA");
    expect(choiceLabel(27)).toBe("AB");
    expect(choiceLabel(51)).toBe("AZ");
    expect(choiceLabel(52)).toBe("BA");
  });

  it("never returns an empty label for a valid position", () => {
    for (let index = 0; index < 60; index++) {
      expect(choiceLabel(index)).toMatch(/^[A-Z]+$/);
    }
  });

  it("degrades safely for a nonsense position", () => {
    expect(choiceLabel(-1)).toBe("?");
    expect(choiceLabel(1.5)).toBe("?");
  });
});

describe("summarizeChoiceShape", () => {
  it("reports a uniform quiz as a single count", () => {
    const shape = summarizeChoiceShape(Array.from({ length: 50 }, () => withDistractors(3)));
    expect(shape).toEqual({
      questionCount: 50,
      minDistractors: 3,
      maxDistractors: 3,
      uniform: true,
    });
  });

  it("reports a mixed quiz as a range", () => {
    const shape = summarizeChoiceShape([
      withDistractors(3),
      withDistractors(4),
      withDistractors(3),
      withDistractors(2),
      withDistractors(5),
    ]);
    expect(shape).toEqual({
      questionCount: 5,
      minDistractors: 2,
      maxDistractors: 5,
      uniform: false,
    });
  });

  it("returns null for an empty set", () => {
    expect(summarizeChoiceShape([])).toBeNull();
  });

  it("handles a single question", () => {
    expect(summarizeChoiceShape([withDistractors(4)])).toEqual({
      questionCount: 1,
      minDistractors: 4,
      maxDistractors: 4,
      uniform: true,
    });
  });
});

describe("describeChoiceShape", () => {
  it("describes a uniform quiz per question", () => {
    const shape = summarizeChoiceShape(Array.from({ length: 50 }, () => withDistractors(3)))!;
    expect(describeChoiceShape(shape)).toEqual({
      questions: "50 questions",
      distractors: "3 distractors per question",
      choices: "4 total choices per question",
    });
  });

  it("describes a mixed quiz as ranges", () => {
    const shape = summarizeChoiceShape([withDistractors(2), withDistractors(5)])!;
    expect(describeChoiceShape(shape)).toEqual({
      questions: "2 questions",
      distractors: "2–5 distractors per question",
      choices: "3–6 total choices",
    });
  });

  it("singularises a one-question quiz", () => {
    const shape = summarizeChoiceShape([withDistractors(5)])!;
    expect(describeChoiceShape(shape).questions).toBe("1 question");
    expect(describeChoiceShape(shape).choices).toBe("6 total choices per question");
  });
});
