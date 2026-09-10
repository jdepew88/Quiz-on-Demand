import { useMemo, useRef, useState } from "react";
import { IconCheck, IconMinus, IconRefresh, IconX } from "./Icons";
import { formatPercent } from "../lib/attempt";
import { choiceLabel } from "../lib/choices";
import type { QuizResult, ReviewEntry, ReviewOutcome } from "../lib/types";

type Filter = "all" | "incorrect" | "unanswered";

/** Every outcome carries a word and an icon, never colour alone. */
const OUTCOME: Record<ReviewOutcome, { label: string; Icon: typeof IconCheck }> = {
  correct: { label: "Correct", Icon: IconCheck },
  incorrect: { label: "Incorrect", Icon: IconX },
  unanswered: { label: "Unanswered", Icon: IconMinus },
};

const OUTCOME_ORDER: ReviewOutcome[] = ["correct", "incorrect", "unanswered"];

export function ResultsScreen({
  result,
  sourceName,
  attemptNumber,
  onRetake,
  onNewQuiz,
}: {
  result: QuizResult;
  sourceName: string;
  attemptNumber: number;
  onRetake: () => void;
  onNewQuiz: () => void;
}) {
  const [filter, setFilter] = useState<Filter>("all");
  const reviewHeadingRef = useRef<HTMLHeadingElement>(null);

  const visible = useMemo(() => {
    if (filter === "all") return result.entries;
    return result.entries.filter((entry) => entry.outcome === filter);
  }, [filter, result.entries]);

  function goToReview() {
    const heading = reviewHeadingRef.current;
    if (!heading) return;
    const reduceMotion =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    heading.scrollIntoView?.({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
    heading.focus({ preventScroll: true });
  }

  const filters: [Filter, string, number][] = [
    ["all", "All", result.total],
    ["incorrect", "Incorrect", result.incorrect],
    ["unanswered", "Unanswered", result.unanswered],
  ];

  return (
    <div className="container container--reading results">
      <section className="score" aria-labelledby="score-heading">
        <h1 id="score-heading" className="score__eyebrow">
          Your score
        </h1>

        <p className="score__raw">
          <span className="score__visual" aria-hidden="true">
            {result.correct}
            <span className="score__of"> / {result.total}</span>
          </span>
          <span className="visually-hidden">
            {result.correct} out of {result.total} correct
          </span>
        </p>
        <p className="score__percent">{formatPercent(result.percent)}</p>

        {result.total > 0 && (
          <div className="score-bar" aria-hidden="true">
            {OUTCOME_ORDER.map((key) =>
              result[key] > 0 ? (
                <span
                  key={key}
                  className={`score-bar__segment score-bar__segment--${key}`}
                  style={{ flexGrow: result[key] }}
                />
              ) : null,
            )}
          </div>
        )}

        <dl className="tally">
          {OUTCOME_ORDER.map((key) => (
            <div key={key} className={`tally__item tally__item--${key}`}>
              <dt>{OUTCOME[key].label}</dt>
              <dd>{result[key]}</dd>
            </div>
          ))}
        </dl>

        <p className="score__meta">
          {sourceName} · Attempt {attemptNumber}
        </p>

        <div className="score__actions">
          <button type="button" className="btn btn--primary btn--lg" onClick={goToReview}>
            Review answers
          </button>
          <button type="button" className="btn btn--secondary btn--lg" onClick={onRetake}>
            <IconRefresh size={18} /> Take again (reshuffle)
          </button>
          <button type="button" className="btn btn--quiet btn--lg" onClick={onNewQuiz}>
            New quiz
          </button>
        </div>
      </section>

      <section className="review" aria-labelledby="review-heading">
        <div className="review__header">
          <div>
            <h2 id="review-heading" className="section-title" ref={reviewHeadingRef} tabIndex={-1}>
              Review
            </h2>
            <p className="review__intro">
              Every question in the order you saw it. Taking the quiz again reshuffles.
            </p>
          </div>

          <div className="segmented" role="group" aria-label="Filter reviewed questions">
            {filters.map(([value, label, count]) => (
              <button
                key={value}
                type="button"
                aria-pressed={filter === value}
                onClick={() => setFilter(value)}
              >
                {label} <span className="segmented__count">{count}</span>
              </button>
            ))}
          </div>
        </div>

        {visible.length === 0 ? (
          <p className="review__empty">
            Nothing to show with this filter.{" "}
            {filter === "incorrect" && result.incorrect === 0 && "You did not miss a single question."}
            {filter === "unanswered" && result.unanswered === 0 && "You answered every question."}
          </p>
        ) : (
          <ul className="review-list">
            {visible.map((entry) => (
              <ReviewCard key={entry.questionId} entry={entry} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function ReviewCard({ entry }: { entry: ReviewEntry }) {
  const { label, Icon } = OUTCOME[entry.outcome];

  return (
    <li className={`review-item review-item--${entry.outcome}`}>
      <div className="review-item__head">
        <span className="outcome">
          <Icon size={16} /> {label}
        </span>
        <span className="review-item__number">Question {entry.displayNumber}</span>
      </div>

      <p className="review-item__prompt">{entry.prompt}</p>

      <ul className="review-choices">
        {entry.choices.map((choice, choiceIndex) => {
          const isCorrect = choice.id === entry.correctChoiceId;
          const isChosenAndWrong = choice.id === entry.selectedChoiceId && !isCorrect;
          const className = [
            "review-choice",
            isCorrect ? "review-choice--correct" : "",
            isChosenAndWrong ? "review-choice--wrong" : "",
          ]
            .filter(Boolean)
            .join(" ");

          return (
            <li key={choice.id} className={className}>
              <span className="review-choice__marker" aria-hidden="true">
                {isCorrect ? (
                  <IconCheck size={14} />
                ) : isChosenAndWrong ? (
                  <IconX size={14} />
                ) : (
                  choiceLabel(choiceIndex)
                )}
              </span>
              <span className="review-choice__text">{choice.text}</span>
              {/* Both tags can apply to the same row when the answer was right; the text
                  spells that out so it does not rely on colour alone. */}
              {isCorrect && (
                <span className="review-choice__tag">
                  {choice.id === entry.selectedChoiceId ? "Your answer · Correct" : "Correct answer"}
                </span>
              )}
              {isChosenAndWrong && <span className="review-choice__tag">Your answer</span>}
            </li>
          );
        })}
      </ul>

      {entry.outcome === "unanswered" && (
        <p className="review-item__note">You did not answer this question.</p>
      )}

      {entry.explanation && (
        <div className="explanation">
          <p className="explanation__label">Explanation</p>
          <p className="explanation__text">{entry.explanation}</p>
        </div>
      )}
    </li>
  );
}
