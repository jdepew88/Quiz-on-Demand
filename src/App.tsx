import { useCallback, useEffect, useRef, useState } from "react";
import { QuizScreen } from "./components/QuizScreen";
import { ResultsScreen } from "./components/ResultsScreen";
import { UploadScreen } from "./components/UploadScreen";
import { buildAttempt, gradeAttempt } from "./lib/attempt";
import type { QuizAttempt, QuizResult, Selections, SourceQuestion } from "./lib/types";

/**
 * Session state.
 *
 * `source` is the uploaded file's questions and is never mutated — every attempt is built
 * from it. Nothing here is persisted: no localStorage, no cookies, no network. Closing the
 * tab ends the session, which is exactly the privacy behaviour the app promises.
 */
interface SessionState {
  source: SourceQuestion[];
  sourceName: string;
  attempt: QuizAttempt;
  selections: Selections;
  result: QuizResult | null;
}

export function App() {
  const [session, setSession] = useState<SessionState | null>(null);

  const startQuiz = useCallback((questions: SourceQuestion[], sourceName: string) => {
    setSession({
      source: questions,
      sourceName,
      attempt: buildAttempt(questions, 1),
      selections: {},
      result: null,
    });
  }, []);

  const selectChoice = useCallback((questionId: string, choiceId: string) => {
    setSession((current) =>
      current === null
        ? current
        : { ...current, selections: { ...current.selections, [questionId]: choiceId } },
    );
  }, []);

  const submitQuiz = useCallback(() => {
    setSession((current) =>
      current === null
        ? current
        : { ...current, result: gradeAttempt(current.attempt, current.selections) },
    );
  }, []);

  /** Same source questions, brand new randomized order and fresh choice order. */
  const retake = useCallback(() => {
    setSession((current) =>
      current === null
        ? current
        : {
            ...current,
            attempt: buildAttempt(current.source, current.attempt.attemptNumber + 1),
            selections: {},
            result: null,
          },
    );
  }, []);

  /** Uploading a new quiz clears every trace of the previous one. */
  const resetToUpload = useCallback(() => setSession(null), []);

  const phase = session === null ? "upload" : session.result ? "results" : "quiz";
  const mainRef = useRef<HTMLElement>(null);
  const isFirstRender = useRef(true);

  // Each phase replaces the whole screen. Two things have to be reset for that to behave
  // like a page change: the scroll position (otherwise the browser keeps the offset from
  // the question you were last looking at) and keyboard focus (the button that triggered
  // the change unmounts, which would otherwise drop focus onto <body> and lose a
  // screen-reader user's place entirely). Skipped on first paint so the app does not
  // steal focus on load.
  useEffect(() => {
    window.scrollTo({ top: 0 });

    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    mainRef.current?.focus();
  }, [phase, session?.attempt.attemptNumber]);

  return (
    <div className="app">
      <a className="skip-link" href="#main">
        Skip to main content
      </a>

      <header className="site-header">
        <div className="shell site-header__inner">
          <span className="brand">
            <span className="brand__mark" aria-hidden="true">
              ?
            </span>
            Quiz on Demand
          </span>
          <span className="small muted">Bring your own questions. Nothing is uploaded.</span>
        </div>
      </header>

      <main className="site-main" id="main" ref={mainRef} tabIndex={-1}>
        {session === null ? (
          <div className="shell">
            <UploadScreen onStart={startQuiz} />
          </div>
        ) : session.result ? (
          <div className="shell">
            <ResultsScreen
              result={session.result}
              sourceName={session.sourceName}
              attemptNumber={session.attempt.attemptNumber}
              onRetake={retake}
              onNewQuiz={resetToUpload}
            />
          </div>
        ) : (
          <QuizScreen
            /* Keyed on the attempt so a reshuffle mounts a genuinely fresh quiz screen —
               question index and any transient UI state start over, with no effect
               needed to reset them. */
            key={session.attempt.attemptNumber}
            attempt={session.attempt}
            selections={session.selections}
            onSelect={selectChoice}
            onSubmit={submitQuiz}
            onExit={resetToUpload}
          />
        )}
      </main>

      <footer className="site-footer">
        <div className="shell site-footer__inner">
          <span>Quiz on Demand — upload a JSON quiz, take it, review it.</span>
          <span>Runs entirely in your browser.</span>
        </div>
      </footer>
    </div>
  );
}
