/**
 * Saved quizzes: browser-local copies of uploaded quiz files, kept in IndexedDB.
 *
 * This is the only module that talks to IndexedDB. It stores the file *as uploaded* — the
 * raw JSON text under its original filename — and nothing else: no scores, no attempts,
 * no timing. Opening a saved quiz hands that text back to the very same parser the upload
 * path uses, so a saved entry can never skip validation, and the rest of the app does not
 * know or care where a quiz came from.
 *
 * Everything is best-effort. IndexedDB can be missing (older private modes), blocked, out
 * of quota, or hold an entry that no longer parses. Every function here resolves or
 * rejects cleanly; nothing throws synchronously, and callers treat failure as "saving is
 * not available right now", never as a reason to stop the quiz.
 */

export const DB_NAME = "quiz-on-demand";
/** Bump when the record shape changes; `onupgradeneeded` is where a migration would go. */
export const DB_VERSION = 1;
export const STORE = "quizzes";
/** Written into every record so a future version can tell old entries apart. */
export const RECORD_VERSION = 1;

/** One saved quiz, exactly as stored. */
export interface SavedQuizRecord {
  /** The original filename — the user-facing identity and the primary key. */
  name: string;
  /** The file's text, verbatim; parsed on open like a fresh upload. */
  text: string;
  /** Epoch ms of the last save or replace. */
  savedAt: number;
  version: number;
}

/** What the list shows: everything but the content. */
export interface SavedQuizSummary {
  name: string;
  savedAt: number;
}

/** True when this browser exposes IndexedDB at all. Opening may still fail. */
export function isSavedQuizStorageAvailable(): boolean {
  return typeof indexedDB !== "undefined" && indexedDB !== null;
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!isSavedQuizStorageAvailable()) {
      reject(new Error("IndexedDB is not available in this browser."));
      return;
    }
    let request: IDBOpenDBRequest;
    try {
      request = indexedDB.open(DB_NAME, DB_VERSION);
    } catch (error) {
      reject(error instanceof Error ? error : new Error("Could not open the saved quizzes store."));
      return;
    }
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "name" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Could not open the saved quizzes store."));
    request.onblocked = () => reject(new Error("The saved quizzes store is in use by another tab."));
  });
}

/** Run one request inside its own transaction and close the database afterwards. */
async function withStore<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await openDatabase();
  try {
    return await new Promise<T>((resolve, reject) => {
      let request: IDBRequest<T>;
      try {
        const tx = db.transaction(STORE, mode);
        tx.onabort = () => reject(tx.error ?? new Error("The saved quizzes transaction was aborted."));
        request = run(tx.objectStore(STORE));
      } catch (error) {
        reject(error instanceof Error ? error : new Error("The saved quizzes store could not be used."));
        return;
      }
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error("The saved quizzes request failed."));
    });
  } finally {
    db.close();
  }
}

function isRecord(value: unknown): value is SavedQuizRecord {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as SavedQuizRecord).name === "string" &&
    typeof (value as SavedQuizRecord).text === "string" &&
    typeof (value as SavedQuizRecord).savedAt === "number"
  );
}

/**
 * Every saved quiz, newest first. A damaged entry is still listed by its name (opening it
 * reports the damage, and the list is where it can be removed); only a value without
 * even a name is dropped, since there is nothing to show for it.
 */
export async function listSavedQuizzes(): Promise<SavedQuizSummary[]> {
  const all = await withStore<unknown[]>("readonly", (store) => store.getAll());
  const summaries: SavedQuizSummary[] = [];
  for (const value of all) {
    if (typeof value !== "object" || value === null) continue;
    const { name, savedAt } = value as Partial<SavedQuizRecord>;
    if (typeof name !== "string") continue;
    summaries.push({ name, savedAt: typeof savedAt === "number" ? savedAt : 0 });
  }
  return summaries.sort((a, b) => b.savedAt - a.savedAt || a.name.localeCompare(b.name));
}

/** True when a quiz with this filename is already saved. */
export async function hasSavedQuiz(name: string): Promise<boolean> {
  const count = await withStore<number>("readonly", (store) => store.count(name));
  return count > 0;
}

/**
 * The stored record, or null when nothing is saved under that name. A stored value that
 * is not a usable record (someone edited site data, or an older build wrote something
 * else) is reported as corrupt rather than returned half-formed.
 */
export async function getSavedQuiz(name: string): Promise<SavedQuizRecord | null> {
  const value = await withStore<unknown>("readonly", (store) => store.get(name));
  if (value === undefined) return null;
  if (!isRecord(value)) throw new Error(`The saved copy of "${name}" is damaged and cannot be opened.`);
  return value;
}

/** Save or replace: the filename is the key, so saving under an existing name overwrites. */
export async function saveQuiz(name: string, text: string, now = Date.now()): Promise<SavedQuizRecord> {
  const record: SavedQuizRecord = { name, text, savedAt: now, version: RECORD_VERSION };
  await withStore<IDBValidKey>("readwrite", (store) => store.put(record));
  return record;
}

export async function removeSavedQuiz(name: string): Promise<void> {
  await withStore<undefined>("readwrite", (store) => store.delete(name));
}
