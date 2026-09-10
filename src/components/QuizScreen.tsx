import { useCallback, useEffect, useRef, useState } from "react";
import { ConfirmSubmitDialog } from "./ConfirmSubmitDialog";
import { countAnswered } from "../lib/attempt";
import { choiceLabel } from "../lib/choices";
import type { QuizAttempt, Selections } from "../lib/types";

export function QuizScreen({
  attempt,
  selections,
  onSelect,
  onSubmit,
  onExit,
}: {
  attempt: QuizAttempt;
  selections: Selections;
  onSelect: (questionId: string, choiceId: string) => void;
  onSubmit: () => void;
  onExit: () => void;
}) {
  const [index, setIndex] = useState(0);
  const [confirming, setConfirming] = useState(false);
  const promptRef = useRef<HTMLLegendElement>(null);
  // Only move focus for a deliberate navigation, never on first paint — otherwise the
  // page would yank focus away the moment the quiz opens.
  const shouldFocusPrompt = useRef(false);

  useEffect(() => {
    if (shouldFocusPrompt.current) {
      shouldFocusPrompt.current = false;
      promptRef.current?.focus();
    }
  }, [index]);

  const goTo = useCallback(
    (next: number) => {
      shouldFocusPrompt.current = true;
      setIndex(Math.min(Math.max(next, 0), attempt.questions.length - 1));
    },
    [attempt.questions.length],
  );

  const total = attempt.questions.length;
  const question = attempt.questions[index];
  const answered = countAnswered(attempt, selections);
  const unanswered = total - answered;
  const percentComplete = total === 0 ? 0 : Math.round((answered / total) * 100);
  const isLast = index === total - 1;

  // `total` is guaranteed non-zero by validation (an empty array is rejected at upload),
  // so this is a defensive branch rather than a reachable state.
  if (!question) return null;

  const selectedChoiceId = selections[question.id];

  return (
    <>
      {/* The quiz screen needs a top-level heading like every other screen. It carries the
          position rather than a static title so a screen-reader user who jumps by heading
          hears where they are. */}
      <h1 className="visually-hidden">
        Quiz in progress — question {index + 1} of {total}
      </h1>

      <div className="quiz-bar">
        <div className="shell">
          <div className="quiz-bar__inner">
            <div className="quiz-bar__meta">
              <span className="quiz-bar__count">
                Question {index + 1} of {total}
              </span>
              <span className="small muted">
                {answered} answered · {unanswered} remaining
              </span>
            </div>
            <div className="btn-row">
              <button type="button" className="btn btn--secondary" onClick={onExit}>
                Upload new quiz
              </button>
              <button type="button" className="btn btn--success" onClick={() => setConfirming(true)}>
                Submit quiz
              </button>
            </div>
          </div>
          <div
            className="progress"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={total}
            aria-valuenow={answered}
            aria-valuetext={`${answered} of ${total} questions answered`}
            aria-label="Quiz progress"
            style={{ marginBottom: "0.8rem" }}
          >
            <div className="progress__fill" style={{ width: `${percentComplete}%` }} />
          </div>
        </div>
      </div>

      <div className="shell quiz-layout">
        <div>
          <section className="card">
            <div className="question-card__head">
              <span className="badge">
                Question {index + 1} / {total}
              </span>
              {!selectedChoiceId && <span className="badge badge--unanswered">Not answered yet</span>}
            </div>

            <fieldset className="question-fieldset">
              <legend className="question-prompt" ref={promptRef} tabIndex={-1}>
                {question.prompt}
              </legend>

              <div className="choices">
                {question.choices.map((choice, choiceIndex) => {
                  const selected = selectedChoiceId === choice.id;
                  return (
                    <label
                      key={choice.id}
                      className={`choice${selected ? " choice--selected" : ""}`}
                      htmlFor={choice.id}
                    >
                      <input
                        type="radio"
                        id={choice.id}
                        name={question.id}
                        value={choice.id}
                        checked={selected}
                        onChange={() => onSelect(question.id, choice.id)}
                      />
                      {/* Computed, so a question with five or six choices is labelled
                          E and F rather than falling off the end of a fixed A-D list.
                          Hidden from assistive tech: the radio's accessible name is the
                          choice text, and a spoken "A." would only add noise. */}
                      <span className="choice__letter" aria-hidden="true">
                        {choiceLabel(choiceIndex)}.
                      </span>
                      <span className="choice__text">{choice.text}</span>
                    </label>
                  );
                })}
              </div>
            </fieldset>

            <p className="small muted" style={{ marginTop: "0.9rem" }}>
              You can change any answer until you submit.
            </p>

            <nav className="quiz-nav" aria-label="Question navigation">
              <button
                type="button"
                className="btn btn--secondary"
                onClick={() => goTo(index - 1)}
                disabled={index === 0}
              >
                ← Previous
              </button>
              {isLast ? (
                <button type="button" className="btn btn--success" onClick={() => setConfirming(true)}>
                  Submit quiz
                </button>
              ) : (
                <button type="button" className="btn" onClick={() => goTo(index + 1)}>
                  Next →
                </button>
              )}
            </nav>
          </section>
        </div>

        <aside className="card" aria-labelledby="navigator-heading">
          <h2 className="card__title" id="navigator-heading" style={{ fontSize: "1rem" }}>
            All questions
          </h2>
          <p className="small muted">
            {answered} of {total} answered
          </p>

          <div className="navigator__grid">
            {attempt.questions.map((item, itemIndex) => {
              const isAnswered = Boolean(selections[item.id]);
              const isCurrent = itemIndex === index;
              return (
                <button
                  key={item.id}
                  type="button"
                  className={[
                    "navigator__btn",
                    isAnswered ? "navigator__btn--answered" : "",
                    isCurrent ? "navigator__btn--current" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  aria-current={isCurrent ? "true" : undefined}
                  aria-label={`Question ${itemIndex + 1}, ${isAnswered ? "answered" : "not answered"}`}
                  onClick={() => goTo(itemIndex)}
                >
                  {itemIndex + 1}
                </button>
              );
            })}
          </div>

          <p className="navigator__legend">
            <span>
              <span className="navigator__swatch navigator__swatch--answered" aria-hidden="true" />
              Answered
            </span>
            <span>
              <span className="navigator__swatch navigator__swatch--unanswered" aria-hidden="true" />
              Unanswered
            </span>
          </p>
        </aside>
      </div>

      {confirming && (
        <ConfirmSubmitDialog
          unansweredCount={unanswered}
          totalCount={total}
          onCancel={() => setConfirming(false)}
          onConfirm={() => {
            setConfirming(false);
            onSubmit();
          }}
        />
      )}
    </>
  );
}
