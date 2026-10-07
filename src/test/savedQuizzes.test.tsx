import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "../App";
import { DB_NAME, DB_VERSION, STORE, getSavedQuiz, listSavedQuizzes, saveQuiz } from "../lib/savedQuizzes";

/**
 * Saved quizzes through the real screens, on a real in-memory IndexedDB. The store is
 * fresh for every test; "reload" is a second render against the same store.
 */

const QUIZ = [
  { question: "What is the capital of France?", answer: "Paris", distractors: ["London", "Berlin", "Madrid"] },
  { question: "What is 2 + 2?", answer: "4", distractors: ["3", "5", "6"] },
  { question: "Which planet is closest to the Sun?", answer: "Mercury", distractors: ["Venus", "Mars", "Earth"] },
];
const OTHER = [{ question: "Only one?", answer: "yes", distractors: ["no", "maybe", "later"] }];
const ANSWERS = new Map([...QUIZ, ...OTHER].map((entry) => [entry.question, entry.answer]));

type User = ReturnType<typeof userEvent.setup>;

const realIndexedDB = globalThis.indexedDB;

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();
});

afterEach(() => {
  globalThis.indexedDB = realIndexedDB;
  vi.restoreAllMocks();
});

function file(data: unknown, name: string): File {
  return new File([JSON.stringify(data, null, 2)], name, { type: "application/json" });
}

async function upload(user: User, data: unknown, name: string) {
  await user.upload(screen.getByLabelText(/choose a json file/i), file(data, name));
  await screen.findByText("Ready to begin");
}

async function renderHome(): Promise<User> {
  const user = userEvent.setup();
  render(<App />);
  return user;
}

const savedSection = () => screen.queryByRole("region", { name: /saved quizzes/i });

async function saveCurrent(user: User) {
  await user.click(screen.getByRole("button", { name: /save this quiz/i }));
  await screen.findByText("Saved locally", { selector: ".save-quiz__done" });
}

function currentQuestionText(): string {
  return within(screen.getByRole("main")).getByRole("group").querySelector("legend")?.textContent ?? "";
}

describe("with nothing saved", () => {
  it("shows no Saved quizzes section at all", async () => {
    await renderHome();
    // Give the (empty) listing a moment to resolve, then confirm nothing appeared.
    await waitFor(() => expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument());
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(savedSection()).toBeNull();
    expect(screen.queryByText(/saved quizzes/i)).not.toBeInTheDocument();
  });
});

describe("saving a quiz", () => {
  it("is offered after a valid upload, keeps the filename, and stores the content", async () => {
    const user = await renderHome();
    await upload(user, QUIZ, "biology-midterm.json");
    expect(screen.getByText("Saved quizzes stay in this browser.")).toBeInTheDocument();
    await saveCurrent(user);

    const record = await getSavedQuiz("biology-midterm.json");
    expect(record?.name).toBe("biology-midterm.json");
    expect(JSON.parse(record?.text ?? "")).toEqual(QUIZ);
    expect(record?.savedAt).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: /save this quiz/i })).not.toBeInTheDocument();
  });

  it("is never automatic", async () => {
    const user = await renderHome();
    await upload(user, QUIZ, "one-off.json");
    await user.click(screen.getByRole("button", { name: /start quiz/i }));
    expect(await listSavedQuizzes()).toEqual([]);
  });

  it("lists the quiz on the homepage and after a reload", async () => {
    const user = await renderHome();
    await upload(user, QUIZ, "history-chapter-8.json");
    await saveCurrent(user);
    await user.click(screen.getByRole("button", { name: /choose a different file/i }));
    const section = await screen.findByRole("region", { name: /saved quizzes/i });
    expect(within(section).getByRole("button", { name: "Open history-chapter-8.json" })).toBeInTheDocument();
    expect(within(section).getByRole("button", { name: "Remove history-chapter-8.json" })).toBeInTheDocument();
    expect(within(section).getByText(/^Saved [A-Z][a-z]{2} \d/)).toBeInTheDocument();

    // "Reload": a brand new app against the same store.
    const { unmount } = render(<></>);
    unmount();
    document.body.innerHTML = "";
    render(<App />);
    const again = await screen.findByRole("region", { name: /saved quizzes/i });
    expect(within(again).getByRole("button", { name: "Open history-chapter-8.json" })).toBeInTheDocument();
  });
});

describe("opening a saved quiz", () => {
  it("goes through the normal setup flow with the original content, options and timer", async () => {
    await saveQuiz("ccna-week-4.json", JSON.stringify(QUIZ));
    const user = await renderHome();
    await user.click(await screen.findByRole("button", { name: "Open ccna-week-4.json" }));

    await screen.findByText("Ready to begin");
    expect(screen.getByText("ccna-week-4.json")).toBeInTheDocument();
    expect(screen.getByText("Saved locally", { selector: ".save-quiz__done" })).toBeInTheDocument();
    expect(screen.getByRole("switch", { name: /shuffle question order/i })).toBeInTheDocument();
    await user.selectOptions(screen.getByRole("combobox", { name: /time limit/i }), "15");
    await user.click(screen.getByRole("button", { name: /start quiz/i }));

    await screen.findByText("Question 1 of 3");
    expect(ANSWERS.has(currentQuestionText())).toBe(true);
    expect(document.querySelector(".timer")?.getAttribute("data-timer-state")).toBe("normal");
    await user.click(screen.getByRole("button", { name: /next/i }));
    expect(screen.getByText("Question 2 of 3")).toBeInTheDocument();
    await user.click(screen.getAllByRole("button", { name: /submit quiz/i })[0]!);
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: /submit anyway/i }));
    expect(await screen.findByRole("heading", { name: /quiz complete/i })).toBeInTheDocument();
    expect(screen.getByText("Time limit", { selector: ".timing-card dt" })).toBeInTheDocument();
    expect(document.querySelectorAll(".review-item")).toHaveLength(3);
  });

  it("reports a damaged entry without crashing and lets it be removed", async () => {
    await new Promise<void>((resolve, reject) => {
      const open = indexedDB.open(DB_NAME, DB_VERSION);
      open.onupgradeneeded = () => open.result.createObjectStore(STORE, { keyPath: "name" });
      open.onsuccess = () => {
        const db = open.result;
        const tx = db.transaction(STORE, "readwrite");
        tx.objectStore(STORE).put({ name: "broken.json", text: 7, savedAt: 1 });
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onerror = () => reject(tx.error);
      };
    });
    const user = await renderHome();
    await user.click(await screen.findByRole("button", { name: "Open broken.json" }));
    expect(await screen.findByRole("status")).toHaveTextContent(/damaged/);
    expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Remove broken.json" }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Remove" }));
    await waitFor(() => expect(savedSection()).toBeNull());
  });

  it("shows a saved file that no longer validates as an ordinary validation failure", async () => {
    await saveQuiz("stale.json", JSON.stringify([{ question: "No answers" }]));
    const user = await renderHome();
    await user.click(await screen.findByRole("button", { name: "Open stale.json" }));
    expect(await screen.findByText(/stale\.json could not be used/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Remove stale.json" })).toBeInTheDocument();
  });
});

describe("duplicate filenames", () => {
  it("asks before replacing, and Replace overwrites the stored copy under the same name", async () => {
    await saveQuiz("quiz.json", JSON.stringify(QUIZ));
    const user = await renderHome();
    await upload(user, OTHER, "quiz.json");
    await user.click(screen.getByRole("button", { name: /save this quiz/i }));

    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveTextContent("“quiz.json” is already saved");
    await user.click(within(dialog).getByRole("button", { name: "Replace" }));
    await screen.findByText("Saved locally", { selector: ".save-quiz__done" });

    const list = await listSavedQuizzes();
    expect(list.map((item) => item.name)).toEqual(["quiz.json"]);
    expect(JSON.parse((await getSavedQuiz("quiz.json"))?.text ?? "")).toEqual(OTHER);
  });

  it("Cancel leaves the saved copy untouched", async () => {
    await saveQuiz("quiz.json", JSON.stringify(QUIZ), 1);
    const user = await renderHome();
    await upload(user, OTHER, "quiz.json");
    await user.click(screen.getByRole("button", { name: /save this quiz/i }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /save this quiz/i })).toHaveFocus();

    expect(await listSavedQuizzes()).toEqual([{ name: "quiz.json", savedAt: 1 }]);
    expect(JSON.parse((await getSavedQuiz("quiz.json"))?.text ?? "")).toEqual(QUIZ);
  });
});

describe("removing", () => {
  it("asks first and then removes only the browser copy, leaving the loaded quiz usable", async () => {
    await saveQuiz("a.json", JSON.stringify(QUIZ));
    await saveQuiz("b.json", JSON.stringify(OTHER));
    const user = await renderHome();
    await user.click(await screen.findByRole("button", { name: "Remove a.json" }));
    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveTextContent("Remove “a.json” from Saved quizzes?");
    expect(dialog).not.toHaveTextContent(/permanently/);
    await user.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(await listSavedQuizzes()).toHaveLength(2);

    await user.click(screen.getByRole("button", { name: "Remove a.json" }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Remove" }));
    await waitFor(() => expect(screen.queryByRole("button", { name: "Open a.json" })).not.toBeInTheDocument());
    expect(screen.getByRole("button", { name: "Open b.json" })).toBeInTheDocument();
    expect((await listSavedQuizzes()).map((item) => item.name)).toEqual(["b.json"]);

    // Opening b, then removing it from a later visit, must not touch the loaded session.
    await user.click(screen.getByRole("button", { name: "Open b.json" }));
    await screen.findByText("Ready to begin");
    await user.click(screen.getByRole("button", { name: /start quiz/i }));
    expect(await screen.findByText("Question 1 of 1")).toBeInTheDocument();
  });
});

describe("without IndexedDB", () => {
  it("still uploads and runs a quiz, and explains that saving failed", async () => {
    // @ts-expect-error simulating a browser with no IndexedDB
    globalThis.indexedDB = undefined;
    const user = await renderHome();
    expect(savedSection()).toBeNull();
    await upload(user, QUIZ, "quiz.json");
    await user.click(screen.getByRole("button", { name: /save this quiz/i }));
    expect(await screen.findByText(/Couldn’t save this quiz in your browser/, { selector: ".save-quiz__error" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /save this quiz/i })).toBeEnabled();

    await user.click(screen.getByRole("button", { name: /start quiz/i }));
    expect(await screen.findByText("Question 1 of 3")).toBeInTheDocument();
  });
});

describe("the sample quiz", () => {
  it("still loads through the same path and can be taken without saving", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify(QUIZ), { status: 200 }));
    const user = await renderHome();
    await user.click(screen.getByRole("button", { name: /try a sample quiz/i }));
    await screen.findByText("Ready to begin");
    expect(screen.getByText("sample-quiz.json")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /save this quiz/i })).toBeInTheDocument();
    expect(await listSavedQuizzes()).toEqual([]);
  });
});
