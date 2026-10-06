import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type DragEvent,
  type MouseEvent,
} from "react";
import { FormatGuide, SAMPLE_FILE } from "./FormatGuide";
import { HeroVisual } from "./HeroVisual";
import { IconAlert, IconArrowRight, IconPencil, IconPlay, IconUpload } from "./Icons";
import { PrivacyNote } from "./PrivacyNote";
import { SetupScreen } from "./SetupScreen";
import type { AttemptOptions } from "../lib/attempt";
import { parseQuizFile, type ValidationResult } from "../lib/validation";
import type { SourceQuestion } from "../lib/types";

/** Beyond this the list stops being a to-do list and starts being a wall. */
const MAX_ISSUES_SHOWN = 25;

interface LoadedFile {
  name: string;
  result: ValidationResult;
}

/**
 * The landing screen. Hierarchy, top to bottom: what this does, the upload control, three
 * ways to start, and only then the format guide. Once a file validates the whole landing is
 * replaced by the setup state (`SetupScreen`) until the quiz starts or the file is swapped.
 */
export function UploadScreen({
  onStart,
  onSetupChange,
}: {
  onStart: (questions: SourceQuestion[], sourceName: string, options: AttemptOptions) => void;
  /** Reports whether the setup state is showing, so the shell can adapt its header. */
  onSetupChange?: (open: boolean) => void;
}) {
  const [loaded, setLoaded] = useState<LoadedFile | null>(null);
  const [dragging, setDragging] = useState(false);
  const [readError, setReadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const statusRef = useRef<HTMLDivElement>(null);
  // Nested dragenter/dragleave events fire for child elements too; counting them keeps the
  // highlight from flickering as the pointer crosses the inner text.
  const dragDepth = useRef(0);

  const acceptText = useCallback((name: string, text: string) => {
    setReadError(null);
    setLoaded({ name, result: parseQuizFile(text) });
    // Move the reader to the outcome — it replaces the landing, or appears below the drop area.
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

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    dragDepth.current = 0;
    setDragging(false);
    const file = event.dataTransfer.files?.[0];
    if (file) void readFile(file);
  }

  function handleZoneClick(event: MouseEvent<HTMLDivElement>) {
    // The labelled button opens the picker by itself; this only extends the target to the
    // rest of the card, so a touch user can tap anywhere on it. Keyboard users have the
    // button, so this is an enhancement rather than the only way in.
    if ((event.target as HTMLElement).closest("label, input, button, a")) return;
    if (!busy) inputRef.current?.click();
  }

  const questions = loaded?.result.ok ? loaded.result.questions : null;
  const issues = loaded && !loaded.result.ok ? loaded.result.issues : null;

  useEffect(() => {
    onSetupChange?.(questions !== null);
  }, [questions, onSetupChange]);

  if (questions && loaded) {
    return (
      <div className="container">
        <div ref={statusRef} tabIndex={-1} className="upload__status">
          <SetupScreen
            fileName={loaded.name}
            questions={questions}
            onStart={(options) => onStart(questions, loaded.name, options)}
            onChangeFile={() => setLoaded(null)}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="container landing">
      <section className="hero" aria-labelledby="hero-title">
        <div className="hero__copy">
          <p className="eyebrow hero__eyebrow">Quiz on Demand</p>
          <h1 id="hero-title" className="hero__title">
            Any quiz. <span className="hero__mark">Any subject.</span>
          </h1>
          <p className="hero__lede">
            Upload a quiz file, take it in a fresh random order, then review exactly what you
            missed.
          </p>

          <section className="upload" aria-label="Load a quiz">
            <div
              className={[
                "dropzone",
                dragging ? "dropzone--active" : "",
                busy ? "dropzone--busy" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              onClick={handleZoneClick}
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
                <IconUpload size={24} />
              </span>
              <p className="dropzone__title">
                <span className="dropzone__title-pointer">
                  {dragging ? "Release to load your quiz" : "Drop your quiz file here"}
                </span>
                <span className="dropzone__title-touch">Choose your quiz file</span>
              </p>
              <p className="dropzone__or">or</p>

              <div className="file-field">
                <label className="btn btn--primary btn--lg" htmlFor={inputId}>
                  Choose a JSON file
                </label>
                <input
                  id={inputId}
                  ref={inputRef}
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

              <p className="dropzone__hint" aria-live="polite">
                {busy ? "Reading file…" : "A .json file · read on this device, never uploaded"}
              </p>
            </div>

            {/* Focus is moved here after a file is read, which is what announces the outcome.
                An aria-live region on the same node would duplicate the whole panel. */}
            <div ref={statusRef} tabIndex={-1} className="upload__status">
              {readError && (
                <div className="issues issues--compact">
                  <div className="issues__head">
                    <span className="issues__icon" aria-hidden="true">
                      <IconAlert size={20} />
                    </span>
                    <p className="issues__title">{readError}</p>
                  </div>
                </div>
              )}

              {issues && loaded && (
                <section className="issues" aria-labelledby="issues-heading">
                  <div className="issues__head">
                    <span className="issues__icon" aria-hidden="true">
                      <IconAlert size={20} />
                    </span>
                    <div>
                      <h2 id="issues-heading" className="issues__title">
                        {loaded.name} could not be used
                      </h2>
                      <p className="issues__sub">
                        {issues.length} problem{issues.length === 1 ? "" : "s"} found. Nothing
                        was discarded — fix the file and upload it again.
                      </p>
                    </div>
                  </div>

                  <ol className="issues__list">
                    {issues.slice(0, MAX_ISSUES_SHOWN).map((issue, index) => (
                      <li key={`${issue.questionNumber ?? "file"}-${index}`}>
                        <span className="issues__where">
                          {issue.questionNumber === null
                            ? "Whole file"
                            : `Question ${issue.questionNumber}`}
                        </span>
                        <span className="visually-hidden">: </span>
                        <span className="issues__message">{issue.message}</span>
                      </li>
                    ))}
                  </ol>

                  {issues.length > MAX_ISSUES_SHOWN && (
                    <p className="issues__more">
                      …and {issues.length - MAX_ISSUES_SHOWN} more problem
                      {issues.length - MAX_ISSUES_SHOWN === 1 ? "" : "s"}. Fix these first,
                      then upload again to see the rest.
                    </p>
                  )}
                </section>
              )}
            </div>

            <PrivacyNote />
          </section>
        </div>

        <HeroVisual />
      </section>

      <section className="starts" aria-labelledby="starts-title">
        <h2 id="starts-title" className="visually-hidden">
          Ways to start
        </h2>
        <div className="starts__grid">
          <button
            type="button"
            className="start-card"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
          >
            <span className="start-card__icon" aria-hidden="true">
              <IconUpload size={20} />
            </span>
            <span className="start-card__title">Upload a quiz</span>
            <span className="start-card__text">Pick a .json quiz file from your device.</span>
            <span className="start-card__arrow" aria-hidden="true">
              <IconArrowRight size={18} />
            </span>
          </button>

          <button
            type="button"
            className="start-card"
            onClick={() => void loadSample()}
            disabled={busy}
          >
            <span className="start-card__icon" aria-hidden="true">
              <IconPlay size={20} />
            </span>
            <span className="start-card__title">Try a sample quiz</span>
            <span className="start-card__text">
              Twenty general-knowledge questions, ready to go.
            </span>
            <span className="start-card__arrow" aria-hidden="true">
              <IconArrowRight size={18} />
            </span>
          </button>

          <a className="start-card" href="#format-guide">
            <span className="start-card__icon" aria-hidden="true">
              <IconPencil size={20} />
            </span>
            <span className="start-card__title">Make your own</span>
            <span className="start-card__text">
              Write questions in a simple text file. The format takes a minute to learn.
            </span>
            <span className="start-card__arrow" aria-hidden="true">
              <IconArrowRight size={18} />
            </span>
          </a>
        </div>
      </section>

      <FormatGuide />
    </div>
  );
}
