import { useCallback, useEffect, useRef, useState } from "react";
import { ConfirmSubmitDialog } from "./ConfirmSubmitDialog";
import { IconArrowLeft, IconArrowRight, IconCheck } from "./Icons";
import { countAnswered } from "../lib/attempt";
import { choiceLabel } from "../lib/choices";
import type { QuizAttempt, Selections } from "../lib/types";

/**
 * The quiz screen. The question is the visual centre; progress sits in a slim sticky bar
 * above it, and navigation below it is deliberately quieter than the answer choices.
 *
 * Nothing on this screen styles a choice by correctness — the correct answer is not
 * detectable before submission, from the markup or from the pixels.
 */
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
        <div className="container container--reading quiz-bar__inner">
          <p className="quiz-bar__status">
            <span className="quiz-bar__count">
              Question {index + 1} of {total}
            </span>
            <span className="quiz-bar__answered">
              {answered} answered · {unanswered} remaining
            </span>
          </p>
          <div className="quiz-bar__actions">
            <button type="button" className="btn btn--quiet btn--sm" onClick={onExit}>
              New quiz
            </button>
            <button
              type="button"
              className="btn btn--secondary btn--sm"
              onClick={() => setConfirming(true)}
            >
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
        >
          <div className="progress__fill" style={{ width: `${percentComplete}%` }} />
        </div>
      </div>

      <div className="container container--reading quiz">
        <div className="question-card">
          {/* Keyed on the question so each one enters with a brief fade — the change of
              question is felt, not just read in the progress bar. */}
          <div key={question.id} className="question-card__inner">
            <div className="question-card__meta">
              <span className="question-card__number">Question {index + 1}</span>
              {selectedChoiceId ? (
                <span className="status-pill status-pill--done">
                  <IconCheck size={14} /> Answered
                </span>
              ) : (
                <span className="status-pill status-pill--pending">Not answered yet</span>
              )}
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
                      {/* The native radio stays in charge of semantics and keyboard
                          behaviour (arrow keys move between choices); it is stretched
                          invisibly over the whole card so every pixel is a tap target. */}
                      <input
                        type="radio"
                        className="choice__input"
                        id={choice.id}
                        name={question.id}
                        value={choice.id}
                        checked={selected}
                        onChange={() => onSelect(question.id, choice.id)}
                      />
                      {/* Computed, so a question with five or six choices is labelled E
                          and F rather than falling off the end of a fixed A-D list.
                          Hidden from assistive tech: the radio's accessible name is the
                          choice text, and a spoken letter would only add noise. */}
                      <span className="choice__letter" aria-hidden="true">
                        {choiceLabel(choiceIndex)}
                      </span>
                      <span className="choice__text">{choice.text}</span>
                      <span className="choice__check" aria-hidden="true">
                        <IconCheck size={18} />
                      </span>
                    </label>
                  );
                })}
              </div>
            </fieldset>

            <p className="quiz-hint">You can change any answer until you submit.</p>
          </div>

          <nav className="quiz-nav" aria-label="Question navigation">
            <button
              type="button"
              className="btn btn--quiet"
              onClick={() => goTo(index - 1)}
              disabled={index === 0}
            >
              <IconArrowLeft size={18} /> Previous
            </button>
            {isLast ? (
              <button type="button" className="btn btn--primary" onClick={() => setConfirming(true)}>
                Submit quiz
              </button>
            ) : (
              <button type="button" className="btn btn--secondary" onClick={() => goTo(index + 1)}>
                Next <IconArrowRight size={18} />
              </button>
            )}
          </nav>
        </div>

        <aside className="navigator" aria-labelledby="navigator-heading">
          <div className="navigator__head">
            <h2 className="navigator__title" id="navigator-heading">
              All questions
            </h2>
            <p className="navigator__legend">
              <span>
                <span className="navigator__swatch navigator__swatch--answered" aria-hidden="true" />
                Answered
              </span>
              <span>
                <span className="navigator__swatch" aria-hidden="true" />
                Unanswered
              </span>
            </p>
          </div>

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
