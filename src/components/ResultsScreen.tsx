import { useMemo, useState } from "react";
import { PrivacyNote } from "./PrivacyNote";
import { formatPercent } from "../lib/attempt";
import { choiceLabel } from "../lib/choices";
import type { QuizResult, ReviewEntry, ReviewOutcome } from "../lib/types";

type Filter = "all" | "incorrect" | "unanswered";

const OUTCOME_LABEL: Record<ReviewOutcome, string> = {
  correct: "Correct",
  incorrect: "Incorrect",
  unanswered: "Unanswered",
};

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

  const visible = useMemo(() => {
    if (filter === "all") return result.entries;
    return result.entries.filter((entry) => entry.outcome === filter);
  }, [filter, result.entries]);

  return (
    <div className="stack">
      <section className="card score-card" aria-labelledby="score-heading">
        <h1 id="score-heading" style={{ fontSize: "1.1rem", color: "var(--text-muted)" }}>
          Your score
        </h1>
        <p className="score-card__raw">
          {result.correct} / {result.total}
        </p>
        <p className="score-card__percent">{formatPercent(result.percent)}</p>
        <p className="small muted" style={{ marginTop: "0.5rem" }}>
          {sourceName} · attempt {attemptNumber}
        </p>

        <div className="stat-grid">
          <div className="stat stat--correct">
            <p className="stat__value">{result.correct}</p>
            <p className="stat__label">Correct</p>
          </div>
          <div className="stat stat--incorrect">
            <p className="stat__value">{result.incorrect}</p>
            <p className="stat__label">Incorrect</p>
          </div>
          <div className="stat stat--unanswered">
            <p className="stat__value">{result.unanswered}</p>
            <p className="stat__label">Unanswered</p>
          </div>
          <div className="stat">
            <p className="stat__value">{result.total}</p>
            <p className="stat__label">Questions</p>
          </div>
        </div>

        <div className="btn-row" style={{ justifyContent: "center", marginTop: "1.4rem" }}>
          <button type="button" className="btn btn--lg" onClick={onRetake}>
            Take again (reshuffle)
          </button>
          <button type="button" className="btn btn--secondary btn--lg" onClick={onNewQuiz}>
            Upload new quiz
          </button>
        </div>
      </section>

      <section className="stack--tight" aria-labelledby="review-heading">
        <h2 id="review-heading" style={{ fontSize: "1.3rem" }}>
          Review
        </h2>
        <p className="muted small">
          Every question from this attempt, in the order you saw it. Reshuffling produces a new
          order.
        </p>

        <div className="filter-row" role="group" aria-label="Filter reviewed questions">
          {(
            [
              ["all", `All ${result.total}`],
              ["incorrect", `Incorrect ${result.incorrect}`],
              ["unanswered", `Unanswered ${result.unanswered}`],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              className="filter-btn"
              aria-pressed={filter === value}
              onClick={() => setFilter(value)}
            >
              {label}
            </button>
          ))}
        </div>

        {visible.length === 0 ? (
          <p className="notice notice--success" style={{ marginTop: "0.9rem" }}>
            Nothing to show with this filter.{" "}
            {filter === "incorrect" && result.incorrect === 0 && "You did not miss a single question."}
            {filter === "unanswered" &&
              result.unanswered === 0 &&
              "You answered every question."}
          </p>
        ) : (
          <ul className="review-list" style={{ marginTop: "0.9rem" }}>
            {visible.map((entry) => (
              <ReviewCard key={entry.questionId} entry={entry} />
            ))}
          </ul>
        )}
      </section>

      <PrivacyNote />
    </div>
  );
}

function ReviewCard({ entry }: { entry: ReviewEntry }) {
  return (
    <li className={`review-item review-item--${entry.outcome}`}>
      <div className="review-item__head">
        <span className="badge">Question {entry.displayNumber}</span>
        <span className={`badge badge--${entry.outcome}`}>
          <span aria-hidden="true">
            {entry.outcome === "correct" ? "✓" : entry.outcome === "incorrect" ? "✕" : "—"}
          </span>
          {OUTCOME_LABEL[entry.outcome]}
        </span>
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
                {isCorrect ? "✓" : isChosenAndWrong ? "✕" : choiceLabel(choiceIndex)}
              </span>
              <span className="choice__text">{choice.text}</span>
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
        <p className="small muted" style={{ marginTop: "0.6rem" }}>
          You did not answer this question.
        </p>
      )}

      {entry.explanation && <p className="review-item__explanation">{entry.explanation}</p>}
    </li>
  );
}
