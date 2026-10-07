import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  DB_NAME,
  DB_VERSION,
  RECORD_VERSION,
  STORE,
  getSavedQuiz,
  hasSavedQuiz,
  isSavedQuizStorageAvailable,
  listSavedQuizzes,
  removeSavedQuiz,
  saveQuiz,
} from "./savedQuizzes";

/**
 * The persistence layer against a real (in-memory) IndexedDB implementation. Each test
 * gets a fresh factory, so nothing leaks between them.
 */

const realIndexedDB = globalThis.indexedDB;

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();
});

afterEach(() => {
  globalThis.indexedDB = realIndexedDB;
});

/** Write a raw value straight into the store, bypassing the module (to plant bad data). */
function plant(value: unknown): Promise<void> {
  return new Promise((resolve, reject) => {
    const open = indexedDB.open(DB_NAME, DB_VERSION);
    open.onupgradeneeded = () => open.result.createObjectStore(STORE, { keyPath: "name" });
    open.onsuccess = () => {
      const db = open.result;
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(value);
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => reject(tx.error);
    };
    open.onerror = () => reject(open.error);
  });
}

const TEXT = JSON.stringify([{ question: "Q?", answer: "a", distractors: ["b", "c", "d"] }]);

describe("saving", () => {
  it("stores the file under its original name with the text verbatim and a timestamp", async () => {
    const record = await saveQuiz("ccna-week-4.json", TEXT, 1_700_000_000_000);
    expect(record).toEqual({ name: "ccna-week-4.json", text: TEXT, savedAt: 1_700_000_000_000, version: RECORD_VERSION });
    expect(await getSavedQuiz("ccna-week-4.json")).toEqual(record);
    expect(await hasSavedQuiz("ccna-week-4.json")).toBe(true);
    expect(await hasSavedQuiz("other.json")).toBe(false);
  });

  it("replaces under the same name rather than creating a numbered copy", async () => {
    await saveQuiz("quiz.json", TEXT, 1);
    await saveQuiz("quiz.json", "[]", 2);
    const list = await listSavedQuizzes();
    expect(list).toEqual([{ name: "quiz.json", savedAt: 2 }]);
    expect((await getSavedQuiz("quiz.json"))?.text).toBe("[]");
  });

  it("survives a fresh connection, as a page reload would be", async () => {
    await saveQuiz("biology-midterm.json", TEXT, 5);
    // The module opens and closes the database per call; the factory keeps the data.
    expect(await listSavedQuizzes()).toEqual([{ name: "biology-midterm.json", savedAt: 5 }]);
  });
});

describe("listing", () => {
  it("is empty in a fresh browser", async () => {
    expect(await listSavedQuizzes()).toEqual([]);
  });

  it("lists newest first and keeps a damaged entry by name so it can be removed", async () => {
    await saveQuiz("old.json", TEXT, 1);
    await saveQuiz("new.json", TEXT, 3);
    await plant({ name: "weird.json", savedAt: 2 }); // no text: damaged, still removable
    expect((await listSavedQuizzes()).map((item) => item.name)).toEqual(["new.json", "weird.json", "old.json"]);
  });
});

describe("opening", () => {
  it("returns null for a name that is not saved", async () => {
    expect(await getSavedQuiz("missing.json")).toBeNull();
  });

  it("reports a damaged entry instead of returning it", async () => {
    await plant({ name: "broken.json", text: 42, savedAt: 1 });
    await expect(getSavedQuiz("broken.json")).rejects.toThrow(/damaged/);
  });
});

describe("removing", () => {
  it("removes only the named quiz", async () => {
    await saveQuiz("a.json", TEXT, 1);
    await saveQuiz("b.json", TEXT, 2);
    await removeSavedQuiz("a.json");
    expect((await listSavedQuizzes()).map((item) => item.name)).toEqual(["b.json"]);
    await removeSavedQuiz("never-saved.json"); // a no-op, not an error
  });
});

describe("without IndexedDB", () => {
  it("reports storage as unavailable and rejects cleanly", async () => {
    // @ts-expect-error simulating a browser with no IndexedDB
    globalThis.indexedDB = undefined;
    expect(isSavedQuizStorageAvailable()).toBe(false);
    await expect(saveQuiz("x.json", TEXT)).rejects.toThrow(/not available/);
    await expect(listSavedQuizzes()).rejects.toThrow();
  });
});
