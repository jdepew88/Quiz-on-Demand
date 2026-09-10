import { useCallback, useId, useMemo, useRef, useState } from "react";
import { FormatGuide, SAMPLE_FILE } from "./FormatGuide";
import { PrivacyNote } from "./PrivacyNote";
import { formatIssue, parseQuizFile, type ValidationResult } from "../lib/validation";
import { describeChoiceShape, summarizeChoiceShape } from "../lib/choices";
import type { SourceQuestion } from "../lib/types";

/** Beyond this the list stops being a to-do list and starts being a wall. */
const MAX_ISSUES_SHOWN = 25;

interface LoadedFile {
  name: string;
  result: ValidationResult;
}

export function UploadScreen({
  onStart,
}: {
  onStart: (questions: SourceQuestion[], sourceName: string) => void;
}) {
  const [loaded, setLoaded] = useState<LoadedFile | null>(null);
  const [dragging, setDragging] = useState(false);
  const [readError, setReadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const inputId = useId();
  const statusRef = useRef<HTMLDivElement>(null);
  // Nested dragenter/dragleave events fire for child elements too; counting them keeps the
  // highlight from flickering as the pointer crosses the inner text.
  const dragDepth = useRef(0);

  const acceptText = useCallback((name: string, text: string) => {
    setReadError(null);
    setLoaded({ name, result: parseQuizFile(text) });
    // Move the reader to the outcome — the panel appears below the fold on small screens.
    window.requestAnimationFrame(() => statusRef.current?.focus());
  }, []);

  const readFile = useCallback(
    async (file: File) => {
      setBusy(true);
      try {
        acceptText(file.name, await file.text());
      } catch {
        setLoaded(null);
        setReadError(`Could not read "${file.name}". Try choosing the file again.`);
      } finally {
        setBusy(false);
      }
    },
    [acceptText],
  );

  const loadSample = useCallback(async () => {
    setBusy(true);
    try {
      const response = await fetch(SAMPLE_FILE);
      if (!response.ok) throw new Error(String(response.status));
      acceptText("sample-quiz.json", await response.text());
    } catch {
      setLoaded(null);
      setReadError("Could not load the sample quiz. You can still download it and upload it.");
    } finally {
      setBusy(false);
    }
  }, [acceptText]);

  function handleDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    dragDepth.current = 0;
    setDragging(false);
    const file = event.dataTransfer.files?.[0];
    if (file) void readFile(file);
  }

  const questionCount = loaded?.result.ok ? loaded.result.questions.length : 0;

  // Report the answer-choice structure back, so the author can see at a glance whether the
  // file is shaped the way they meant — a stray fourth distractor in one question shows up
  // here as a range rather than passing unnoticed.
  const shape = useMemo(
    () => (loaded?.result.ok ? summarizeChoiceShape(loaded.result.questions) : null),
    [loaded],
  );
  const shapeLabels = shape ? describeChoiceShape(shape) : null;

  return (
    <div className="stack">
      <div className="hero">
        <h1>Take a quiz on demand</h1>
        <p>
          Upload a JSON quiz file, get a freshly shuffled set of questions, and see exactly what
          you got right and wrong. Works for any subject — no account, no setup.
        </p>
      </div>

      <div
        className={`dropzone${dragging ? " dropzone--active" : ""}`}
        onDragEnter={(event) => {
          event.preventDefault();
          dragDepth.current += 1;
          setDragging(true);
        }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={(event) => {
          event.preventDefault();
          dragDepth.current = Math.max(0, dragDepth.current - 1);
          if (dragDepth.current === 0) setDragging(false);
        }}
        onDrop={handleDrop}
      >
        <span className="dropzone__icon" aria-hidden="true">
          📄
        </span>
        <p style={{ fontWeight: 600, fontSize: "1.05rem" }}>
          {dragging ? "Drop your quiz file to load it" : "Drag and drop your .json quiz file here"}
        </p>
        <p className="dropzone__hint">or</p>

        <div className="file-field">
          <label className="file-label" htmlFor={inputId}>
            Choose a JSON file
          </label>
          <input
            id={inputId}
            className="file-input"
            type="file"
            accept=".json,application/json"
            disabled={busy}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void readFile(file);
              // Reset so re-choosing the same file after an edit still fires onChange.
              event.target.value = "";
            }}
          />
        </div>

        <p className="dropzone__hint">{busy ? "Reading file…" : "Nothing leaves your browser."}</p>
      </div>

      {/* Focus is moved here after a file is read, which is what announces the outcome.
          An aria-live region on the same node would duplicate the whole panel. */}
      <div ref={statusRef} tabIndex={-1} className="stack--tight">
        {readError && (
          <div className="notice notice--error">
            <strong>{readError}</strong>
          </div>
        )}

        {loaded?.result.ok && (
          <section className="card stack--tight" style={{ display: "grid", gap: "0.9rem" }}>
            <div className="notice notice--success">
              <strong>{loaded.name} looks good.</strong>{" "}
              {questionCount} valid question{questionCount === 1 ? "" : "s"} detected.
            </div>

            {shapeLabels && (
              <ul className="shape-summary">
                <li>{shapeLabels.questions}</li>
                <li>{shapeLabels.distractors}</li>
                <li>{shapeLabels.choices}</li>
              </ul>
            )}

            <p className="small muted">
              Questions and answer choices are shuffled fresh each time you start.
            </p>
            <div className="btn-row">
              <button
                type="button"
                className="btn btn--lg"
                onClick={() => {
                  if (loaded.result.ok) onStart(loaded.result.questions, loaded.name);
                }}
              >
                Start quiz →
              </button>
              <button type="button" className="btn btn--secondary" onClick={() => setLoaded(null)}>
                Choose a different file
              </button>
            </div>
          </section>
        )}

        {loaded && !loaded.result.ok && (
          <section className="card" aria-labelledby="issues-heading">
            <div className="notice notice--error">
              <strong id="issues-heading">
                {loaded.name} could not be used ({loaded.result.issues.length} problem
                {loaded.result.issues.length === 1 ? "" : "s"} found).
              </strong>
              <p className="small" style={{ marginTop: "0.3rem" }}>
                Nothing was discarded — fix the file and upload it again.
              </p>
            </div>
            <ul className="issue-list">
              {loaded.result.issues.slice(0, MAX_ISSUES_SHOWN).map((issue, index) => (
                <li key={`${issue.questionNumber ?? "file"}-${index}`}>
                  <span className="issue-list__num" aria-hidden="true">
                    {issue.questionNumber === null ? "!" : issue.questionNumber}
                  </span>
                  <span>{formatIssue(issue)}</span>
                </li>
              ))}
            </ul>
            {loaded.result.issues.length > MAX_ISSUES_SHOWN && (
              <p className="small muted" style={{ marginTop: "0.6rem" }}>
                …and {loaded.result.issues.length - MAX_ISSUES_SHOWN} more problem
                {loaded.result.issues.length - MAX_ISSUES_SHOWN === 1 ? "" : "s"}. Fix these first,
                then upload again to see the rest.
              </p>
            )}
          </section>
        )}
      </div>

      <FormatGuide onLoadSample={() => void loadSample()} />

      <PrivacyNote />
    </div>
  );
}
