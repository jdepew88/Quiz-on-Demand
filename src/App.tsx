import { useCallback, useEffect, useRef, useState } from "react";
import { QuizScreen } from "./components/QuizScreen";
import { ResultsScreen } from "./components/ResultsScreen";
import { SiteHeader } from "./components/SiteHeader";
import { UploadScreen } from "./components/UploadScreen";
import { buildAttempt, gradeAttempt, type AttemptOptions } from "./lib/attempt";
import type { QuizAttempt, QuizResult, Selections, SourceQuestion } from "./lib/types";

/**
 * Session state.
 *
 * `source` is the uploaded file's questions and is never mutated — every attempt is built
 * from it. Quiz content is never persisted: no localStorage, no cookies, no network. Closing
 * the tab ends the session, which is exactly the privacy behaviour the app promises. (The one
 * thing kept on the device is the light/dark theme choice — see lib/theme.ts — which says
 * nothing about any quiz.)
 */
interface SessionState {
  source: SourceQuestion[];
  sourceName: string;
  /** The setup-screen choices, kept so "Take it again" rebuilds the same kind of attempt. */
  options: AttemptOptions;
  attempt: QuizAttempt;
  selections: Selections;
  result: QuizResult | null;
}

export function App() {
  const [session, setSession] = useState<SessionState | null>(null);
  // The upload screen owns the loaded file; it only reports whether it is showing the
  // setup state, so the header can drop the "Format guide" link while the guide is hidden.
  const [setupOpen, setSetupOpen] = useState(false);

  const startQuiz = useCallback(
    (questions: SourceQuestion[], sourceName: string, options: AttemptOptions) => {
      setSession({
        source: questions,
        sourceName,
        options,
        attempt: buildAttempt(questions, 1, Math.random, options),
        selections: {},
        result: null,
      });
    },
    [],
  );

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

  /** Same source questions and options, brand new randomized order and fresh choice order. */
  const retake = useCallback(() => {
    setSession((current) =>
      current === null
        ? current
        : {
            ...current,
            attempt: buildAttempt(
              current.source,
              current.attempt.attemptNumber + 1,
              Math.random,
              current.options,
            ),
            selections: {},
            result: null,
          },
    );
  }, []);

  /** Starting a new quiz clears every trace of the previous one. */
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

    // preventScroll: focusing <main> would otherwise scroll it to the top of the viewport,
    // pushing the site header (and its theme control) out of sight on every new screen.
    mainRef.current?.focus({ preventScroll: true });
  }, [phase, session?.attempt.attemptNumber]);

  return (
    <div className="app">
      <a className="skip-link" href="#main">
        Skip to main content
      </a>

      <SiteHeader showGuideLink={phase === "upload" && !setupOpen} />

      <main className="site-main" id="main" ref={mainRef} tabIndex={-1}>
        {session === null ? (
          <UploadScreen onStart={startQuiz} onSetupChange={setSetupOpen} />
        ) : session.result ? (
          <ResultsScreen
            result={session.result}
            sourceName={session.sourceName}
            attemptNumber={session.attempt.attemptNumber}
            onRetake={retake}
            onNewQuiz={resetToUpload}
          />
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
        <div className="container site-footer__inner">
          <span className="site-footer__brand">Quiz on Demand</span>
          <span>Runs entirely in your browser. Your quiz is never uploaded.</span>
        </div>
      </footer>
    </div>
  );
}
