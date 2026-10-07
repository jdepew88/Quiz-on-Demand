import { useCallback, useEffect, useRef, useState } from "react";
import { QuizScreen } from "./components/QuizScreen";
import { ResultsScreen } from "./components/ResultsScreen";
import { SiteHeader } from "./components/SiteHeader";
import { UploadScreen } from "./components/UploadScreen";
import { buildAttempt, gradeAttempt, type AttemptOptions } from "./lib/attempt";
import {
  activateQuestion,
  completeTiming,
  startTiming,
  type QuizTiming,
  type SubmissionKind,
} from "./lib/timing";
import type { QuizAttempt, QuizResult, Selections, SourceQuestion } from "./lib/types";

/**
 * Session state.
 *
 * `source` is the uploaded file's questions and is never mutated — every attempt is built
 * from it. Quiz content is never persisted: no localStorage, no cookies, no network. Closing
 * the tab ends the session, which is exactly the privacy behaviour the app promises. (The one
 * thing kept on the device is the light/dark theme choice — see lib/theme.ts — which says
 * nothing about any quiz.)
 *
 * `timing` is the clock for the current attempt: it starts the moment the quiz starts,
 * follows the active question as the learner moves around, and is frozen by `submitQuiz`
 * so the results never drift afterwards. See lib/timing.ts.
 */
interface SessionState {
  source: SourceQuestion[];
  sourceName: string;
  /** The setup-screen choices, kept so "Take it again" rebuilds the same kind of attempt. */
  options: AttemptOptions;
  /** The chosen time limit, or null for an untimed quiz. Also reused by "Take it again". */
  timeLimitMs: number | null;
  attempt: QuizAttempt;
  timing: QuizTiming;
  selections: Selections;
  result: QuizResult | null;
  /** How the attempt ended; null while it is still in progress. */
  submission: SubmissionKind | null;
}

function newAttempt(
  current: Pick<SessionState, "source" | "sourceName" | "options" | "timeLimitMs">,
  attemptNumber: number,
): SessionState {
  const attempt = buildAttempt(current.source, attemptNumber, Math.random, current.options);
  return {
    ...current,
    attempt,
    // The clock starts here, on Start quiz (or Take it again) — never during upload or setup.
    timing: startTiming(
      attempt.questions.map((question) => question.id),
      Date.now(),
      current.timeLimitMs,
    ),
    selections: {},
    result: null,
    submission: null,
  };
}

export function App() {
  const [session, setSession] = useState<SessionState | null>(null);
  // The upload screen owns the loaded file; it only reports whether it is showing the
  // setup state, so the header can drop the "Format guide" link while the guide is hidden.
  const [setupOpen, setSetupOpen] = useState(false);

  const startQuiz = useCallback(
    (
      questions: SourceQuestion[],
      sourceName: string,
      options: AttemptOptions,
      timeLimitMs: number | null,
    ) => {
      setSession(newAttempt({ source: questions, sourceName, options, timeLimitMs }, 1));
    },
    [],
  );

  const selectChoice = useCallback((questionId: string, choiceId: string) => {
    setSession((current) =>
      current === null || current.result
        ? current
        : { ...current, selections: { ...current.selections, [questionId]: choiceId } },
    );
  }, []);

  /** The learner moved to a question: close the previous timing segment, open this one. */
  const activate = useCallback((questionId: string) => {
    setSession((current) => {
      if (current === null || current.result) return current;
      const timing = activateQuestion(current.timing, questionId, Date.now());
      return timing === current.timing ? current : { ...current, timing };
    });
  }, []);

  /**
   * Freeze the clock and grade. Exactly once per attempt: a second call (a manual submit
   * racing the deadline, or zero observed by two ticks) finds the result already set and
   * does nothing. A timeout completes at the deadline itself, however late it is noticed.
   */
  const submitQuiz = useCallback((kind: SubmissionKind = "manual") => {
    setSession((current) =>
      current === null || current.result
        ? current
        : {
            ...current,
            timing: completeTiming(current.timing, Date.now()),
            result: gradeAttempt(current.attempt, current.selections),
            submission: kind,
          },
    );
  }, []);

  const expireQuiz = useCallback(() => submitQuiz("timeout"), [submitQuiz]);

  /** Same source questions, options and time limit; brand new order and a fresh clock. */
  const retake = useCallback(() => {
    setSession((current) =>
      current === null ? current : newAttempt(current, current.attempt.attemptNumber + 1),
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
            timing={session.timing}
            submission={session.submission ?? "manual"}
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
            timing={session.timing}
            onSelect={selectChoice}
            onActivate={activate}
            onSubmit={submitQuiz}
            onExpire={expireQuiz}
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
