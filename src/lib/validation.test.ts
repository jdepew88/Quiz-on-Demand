import { describe, expect, it } from "vitest";
import { formatIssue, parseQuizFile, validateQuizData } from "./validation";
import { MAX_CHOICES, MAX_DISTRACTORS, MIN_CHOICES, MIN_DISTRACTORS } from "./choices";

const VALID = [
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
];

/** Every issue message a caller receives, flattened for substring assertions. */
function messages(data: unknown): string[] {
  const result = validateQuizData(data);
  if (result.ok) throw new Error("expected validation to fail");
  return result.issues.map(formatIssue);
}

describe("valid quiz files", () => {
  it("accepts an existing three-distractor file unchanged (legacy format)", () => {
    // The pre-existing default. Files written against the old "exactly three" rule must
    // keep working with no migration whatsoever.
    const result = parseQuizFile(JSON.stringify(VALID));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.questions).toEqual(VALID);
    expect(result.questions.every((question) => question.distractors.length === 3)).toBe(true);
  });

  it("accepts the documented format", () => {
    const result = parseQuizFile(JSON.stringify(VALID));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.questions).toHaveLength(2);
    expect(result.questions[0]).toEqual({
      question: "What is the capital of France?",
      answer: "Paris",
      distractors: ["London", "Berlin", "Madrid"],
    });
  });

  it("accepts any reasonable question count", () => {
    const many = Array.from({ length: 250 }, (_, index) => ({
      question: `Question ${index}?`,
      answer: `Right ${index}`,
      distractors: [`Wrong A ${index}`, `Wrong B ${index}`, `Wrong C ${index}`],
    }));

    const result = validateQuizData(many);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.questions).toHaveLength(250);
  });

  it("trims surrounding whitespace and ignores unknown properties", () => {
    const result = validateQuizData([
      {
        question: "  Padded question?  ",
        answer: "\tPadded answer\n",
        distractors: [" a ", " b ", " c "],
        category: "ignored",
        difficulty: 3,
      },
    ]);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.questions[0]).toEqual({
      question: "Padded question?",
      answer: "Padded answer",
      distractors: ["a", "b", "c"],
    });
  });

  it("keeps an optional explanation and drops a blank one", () => {
    const result = validateQuizData([
      { ...VALID[0], explanation: "  Paris has been the capital since 508 AD.  " },
      { ...VALID[1], explanation: "   " },
    ]);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.questions[0]?.explanation).toBe("Paris has been the capital since 508 AD.");
    expect(result.questions[1]?.explanation).toBeUndefined();
  });
});

describe("malformed JSON", () => {
  it("reports a syntax error with the parser's detail", () => {
    const result = parseQuizFile('[{ "question": "oops" ');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0]?.message).toContain("not valid JSON");
    expect(result.issues[0]?.questionNumber).toBeNull();
  });

  it("reports an empty file", () => {
    const result = parseQuizFile("   \n  ");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues[0]?.message).toBe("The file is empty.");
  });

  it("rejects a non-array root and says what it found", () => {
    expect(messages({ questions: VALID })).toEqual([
      expect.stringContaining("must contain a JSON array"),
    ]);
    expect(messages({ questions: VALID })[0]).toContain("an object");
    expect(messages("just a string")[0]).toContain("a string");
    expect(messages(null)[0]).toContain("null");
  });

  it("rejects an empty quiz", () => {
    expect(messages([])).toEqual([expect.stringContaining("empty array")]);
  });

  it("rejects a non-object entry", () => {
    expect(messages(["not a question"])).toEqual([
      expect.stringContaining("Question 1: Expected an object"),
    ]);
  });
});

describe("missing and blank fields", () => {
  it("reports a missing question", () => {
    expect(messages([{ answer: "a", distractors: ["b", "c", "d"] }])).toEqual([
      'Question 1: Missing the required "question" property.',
    ]);
  });

  it("reports a missing answer", () => {
    expect(messages([{ question: "q?", distractors: ["b", "c", "d"] }])).toEqual([
      'Question 1: Missing the required "answer" property.',
    ]);
  });

  it("reports missing distractors", () => {
    expect(messages([{ question: "q?", answer: "a" }])).toEqual([
      'Question 1: Missing the required "distractors" property.',
    ]);
  });

  it("reports blank strings", () => {
    const found = messages([
      { question: "   ", answer: "\t", distractors: ["b", "  ", "d"] },
    ]);
    expect(found).toEqual([
      'Question 1: "question" is blank.',
      'Question 1: "answer" is blank.',
      "Question 1: Distractor 2 is blank.",
    ]);
  });

  it("reports wrong types with the type it found", () => {
    const found = messages([{ question: 42, answer: true, distractors: "a, b, c" }]);
    expect(found[0]).toContain('"question" must be a string, but it is a number');
    expect(found[1]).toContain('"answer" must be a string, but it is a boolean');
    expect(found[2]).toContain('"distractors" must be an array of 2–5 strings, but it is a string');
  });

  it("reports a non-string distractor entry", () => {
    expect(messages([{ question: "q?", answer: "a", distractors: ["b", 7, "d"] }])).toEqual([
      "Question 1: Distractor 2 must be a string, but it is a number.",
    ]);
  });
});

describe("distractor count", () => {
  /** A question with `count` unique distractors. */
  function withDistractors(count: number) {
    return {
      question: "q?",
      answer: "right",
      distractors: Array.from({ length: count }, (_, index) => `wrong-${index + 1}`),
    };
  }

  it.each([
    [MIN_DISTRACTORS, MIN_CHOICES],
    [3, 4],
    [4, 5],
    [MAX_DISTRACTORS, MAX_CHOICES],
  ])("accepts %i distractors (%i total choices)", (distractorCount) => {
    const result = validateQuizData([withDistractors(distractorCount)]);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.questions[0]?.distractors).toHaveLength(distractorCount);
  });

  it("rejects a single distractor with a message naming the minimum", () => {
    expect(messages([withDistractors(1)])).toEqual([
      "Question 1: Only 1 distractor supplied. At least 2 distractors are required.",
    ]);
  });

  it("rejects more than the maximum with a message naming the maximum", () => {
    expect(messages([withDistractors(6)])).toEqual([
      "Question 1: 6 distractors supplied. The maximum supported number is 5.",
    ]);
  });

  it("rejects a far-too-long list", () => {
    expect(messages([withDistractors(12)])[0]).toContain(
      "12 distractors supplied. The maximum supported number is 5.",
    );
  });

  it("rejects an empty distractor array", () => {
    expect(messages([{ question: "q?", answer: "a", distractors: [] }])).toEqual([
      'Question 1: "distractors" is empty. At least 2 distractors are required.',
    ]);
  });

  it("names the offending question when only one question is out of range", () => {
    const found = messages([withDistractors(3), withDistractors(4), withDistractors(6)]);
    expect(found).toEqual([
      "Question 3: 6 distractors supplied. The maximum supported number is 5.",
    ]);
  });

  it("accepts a quiz that mixes distractor counts across questions", () => {
    const result = validateQuizData([
      withDistractors(3),
      withDistractors(4),
      withDistractors(3),
      withDistractors(2),
      withDistractors(5),
    ]);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.questions.map((question) => question.distractors.length)).toEqual([
        3, 4, 3, 2, 5,
      ]);
    }
  });

  it("still reports the type when distractors is not an array", () => {
    expect(messages([{ question: "q?", answer: "a", distractors: "b, c, d" }])[0]).toContain(
      '"distractors" must be an array of 2–5 strings, but it is a string',
    );
  });
});

describe("duplicate answer choices", () => {
  it("rejects the correct answer repeated as a distractor", () => {
    const found = messages([
      { question: "q?", answer: "Paris", distractors: ["London", "Paris", "Madrid"] },
    ]);
    expect(found).toHaveLength(1);
    expect(found[0]).toContain('The correct answer ("Paris") also appears as distractor 2');
  });

  it("matches duplicates case- and whitespace-insensitively", () => {
    const found = messages([
      { question: "q?", answer: "Paris", distractors: ["London", "  paris  ", "Madrid"] },
    ]);
    expect(found[0]).toContain("also appears as distractor 2");
  });

  it("rejects two identical distractors", () => {
    const found = messages([
      { question: "q?", answer: "Paris", distractors: ["London", "Berlin", "London"] },
    ]);
    expect(found).toHaveLength(1);
    expect(found[0]).toContain("Distractors 1 and 3 are the same choice");
    expect(found[0]).toContain("Every choice must be different.");
  });

  it("catches duplicates and answer clashes at every supported count", () => {
    expect(messages([{ question: "q?", answer: "a", distractors: ["b", "b"] }])[0]).toContain(
      "Distractors 1 and 2 are the same choice",
    );
    expect(
      messages([{ question: "q?", answer: "a", distractors: ["b", "c", "d", "e", "b"] }])[0],
    ).toContain("Distractors 1 and 5 are the same choice");
    expect(messages([{ question: "q?", answer: "a", distractors: ["b", "a"] }])[0]).toContain(
      "also appears as distractor 2",
    );
    expect(
      messages([{ question: "q?", answer: "a", distractors: ["b", "c", "d", "e", "a"] }])[0],
    ).toContain("also appears as distractor 5");
  });

  it("treats whitespace- and case-different values as duplicates at any count", () => {
    expect(
      messages([{ question: "q?", answer: "x", distractors: ["Paris", " paris "] }])[0],
    ).toContain("Distractors 1 and 2 are the same choice");
    expect(
      messages([
        { question: "q?", answer: "x", distractors: ["a", "b", "c", "Paris", "  PARIS  "] },
      ])[0],
    ).toContain("Distractors 4 and 5 are the same choice");
  });

  it("rejects a blank distractor at any count", () => {
    expect(messages([{ question: "q?", answer: "a", distractors: ["b", "   "] }])).toEqual([
      "Question 1: Distractor 2 is blank.",
    ]);
    expect(
      messages([{ question: "q?", answer: "a", distractors: ["b", "c", "d", "e", ""] }]),
    ).toEqual(["Question 1: Distractor 5 is blank."]);
  });

  it("rejects three identical distractors as two pair reports", () => {
    const found = messages([
      { question: "q?", answer: "Paris", distractors: ["x", "x", "x"] },
    ]);
    expect(found).toHaveLength(2);
  });
});

describe("error reporting behaviour", () => {
  it("names the offending question number", () => {
    const found = messages([VALID[0], VALID[1], { question: "q?", answer: "a" }]);
    expect(found).toEqual(['Question 3: Missing the required "distractors" property.']);
  });

  it("collects every problem across the file rather than stopping at the first", () => {
    const found = messages([
      { question: "", answer: "a", distractors: ["b", "c", "d"] },
      VALID[0],
      { question: "q?", answer: "a", distractors: ["b"] },
      { question: "q?", answer: "dupe", distractors: ["dupe", "c", "d"] },
    ]);

    expect(found).toHaveLength(3);
    expect(found[0]).toContain("Question 1");
    expect(found[1]).toContain("Question 3");
    expect(found[2]).toContain("Question 4");
  });

  it("never returns questions alongside issues, so nothing is silently discarded", () => {
    const result = validateQuizData([VALID[0], { question: "broken" }]);
    expect(result.ok).toBe(false);
    expect(result).not.toHaveProperty("questions");
  });

  it("tags issues with the field they belong to", () => {
    const result = validateQuizData([{ question: "q?", answer: "", distractors: ["b", "c", "d"] }]);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues[0]?.field).toBe("answer");
  });
});
