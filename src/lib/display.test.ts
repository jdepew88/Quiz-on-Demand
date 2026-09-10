import { describe, expect, it } from "vitest";
import { quizTitleFromFileName } from "./display";

describe("quizTitleFromFileName", () => {
  it.each([
    ["my-quiz.json", "My Quiz"],
    ["sample-quiz.json", "Sample Quiz"],
    ["fire-officer-emergency-response.json", "Fire Officer Emergency Response"],
    ["history_of_rome.json", "History of Rome"],
    ["the-art-of-war.json", "The Art of War"],
    ["CCNA_practice_v2.json", "CCNA practice v2"],
    ["Biology Unit 3.JSON", "Biology Unit 3"],
    ["  spaced   out  .json", "Spaced Out"],
    ["notes.v2.json", "Notes V2"],
    [".json", "Untitled quiz"],
  ])("%s -> %s", (fileName, expected) => {
    expect(quizTitleFromFileName(fileName)).toBe(expected);
  });
});
