import { describe, expect, it } from "vitest";
import { formatIssue, parseQuizFile, validateQuizData } from "./validation";

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
    expect(found[2]).toContain('"distractors" must be an array of 3 strings, but it is a string');
  });

  it("reports a non-string distractor entry", () => {
    expect(messages([{ question: "q?", answer: "a", distractors: ["b", 7, "d"] }])).toEqual([
      "Question 1: Distractor 2 must be a string, but it is a number.",
    ]);
  });
});

describe("distractor count", () => {
  it("rejects too few", () => {
    expect(messages([{ question: "q?", answer: "a", distractors: ["b", "c"] }])).toEqual([
      'Question 1: "distractors" must contain exactly 3 choices, but it contains 2.',
    ]);
  });

  it("rejects too many", () => {
    expect(messages([{ question: "q?", answer: "a", distractors: ["b", "c", "d", "e"] }])).toEqual([
      'Question 1: "distractors" must contain exactly 3 choices, but it contains 4.',
    ]);
  });

  it("rejects an empty distractor array", () => {
    expect(messages([{ question: "q?", answer: "a", distractors: [] }])[0]).toContain(
      "but it contains 0",
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
