import { gsap } from "gsap";
import { useMemo, useRef, useState } from "react";
import { IconCheck, IconMinus, IconRefresh, IconTrophy, IconX } from "./Icons";
import { formatPercent, isPerfectScore } from "../lib/attempt";
import { choiceLabel } from "../lib/choices";
import { EASE_OUT, prefersReducedMotion, useGsapContext } from "../lib/motion";
import type { QuizResult, ReviewEntry, ReviewOutcome } from "../lib/types";

type Filter = "all" | "incorrect" | "unanswered";

/** Every outcome carries a word and an icon, never colour alone. */
const OUTCOME: Record<ReviewOutcome, { label: string; Icon: typeof IconCheck }> = {
  correct: { label: "Correct", Icon: IconCheck },
  incorrect: { label: "Missed", Icon: IconX },
  unanswered: { label: "Unanswered", Icon: IconMinus },
};

const REVIEW_TITLE: Record<Filter, string> = {
  all: "Review every question",
  incorrect: "Review missed questions",
  unanswered: "Review unanswered questions",
};

/**
 * The perfect-score burst: a handful of gold lines, green and gold dots and two sparks
 * around the percentage. Positioned by CSS (`.score__spark:nth-child(n)`); GSAP only
 * moves them the last stretch into place and fades them out again. Decorative, hidden
 * from assistive technology, and not rendered at all under reduced motion.
 */
const SPARKS: ("line" | "dot" | "star")[] = [
  "line",
  "dot",
  "star",
  "line",
  "dot",
  "line",
  "star",
  "dot",
  "line",
  "dot",
];

const COUNT_UP = 0.8;

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
  const scoreRef = useRef<HTMLElement>(null);
  const percentRef = useRef<HTMLSpanElement>(null);
  const perfect = isPerfectScore(result);
  const percentText = formatPercent(result.percent);
  // Read once per mount: the burst markup is left out entirely under reduced motion.
  const [reduceMotion] = useState(prefersReducedMotion);

  // Results entrance. Everything is in the DOM at its final value from the first render;
  // GSAP fades the pieces in, counts the percentage up from zero (rounded whole numbers,
  // then the exact formatted value), and for a genuine 100% sweeps the gold highlight in
  // behind the figure and lets the sparks out before the stat cards arrive. One pass, then
  // static. The score section is remounted for every attempt, so nothing can stack up.
  useGsapContext(
    scoreRef,
    (root) => {
      if (reduceMotion) {
        root.dataset.entrance = "static";
        return;
      }
      root.dataset.entrance = "playing";
      const percentEl = percentRef.current;

      // Elements that end at rest hand their styling back to the stylesheet; the counter
      // below is a plain object, so this is not a timeline default.
      const settle = { clearProps: "transform,opacity" };
      const tl = gsap.timeline({
        defaults: { ease: EASE_OUT },
        onComplete: () => {
          root.dataset.entrance = "done";
        },
      });

      tl.from(
        [".score__badge", ".score__title", ".score__eyebrow", ".score__raw", ".score__percent"],
        { y: 10, opacity: 0, duration: 0.4, stagger: 0.05, ...settle },
      );

      if (percentEl) {
        const counter = { value: 0 };
        tl.to(
          counter,
          {
            value: result.percent,
            duration: COUNT_UP,
            ease: "power2.out",
            onUpdate: () => {
              percentEl.textContent = `${Math.round(counter.value)}%`;
            },
            onComplete: () => {
              percentEl.textContent = percentText;
            },
          },
          0.2,
        );
      }

      // The stat cards, then the footer line and actions. For a perfect run they wait for
      // the celebration; otherwise they overlap the count-up so the whole thing stays short.
      let cardsAt = 0.3;

      if (perfect) {
        const at = 0.2 + COUNT_UP;
        tl.from(".score__sweep", { scaleX: 0, transformOrigin: "left center", duration: 0.35, ...settle }, at - 0.1);
        tl.from(
          ".score__spark",
          {
            x: (index) => (index % 2 ? 10 : -10),
            y: (index) => (index % 3 ? -8 : 8),
            scale: 0.2,
            rotation: (index) => (index % 2 ? 25 : -25),
            opacity: 0,
            duration: 0.4,
            stagger: { each: 0.03, from: "center" },
          },
          at,
        );
        tl.to(".score__spark", { opacity: 0, duration: 0.4, stagger: 0.02 }, at + 0.75);
        cardsAt = at + 0.45;
      }

      tl.from(".result-card", { y: 10, opacity: 0, duration: 0.35, stagger: 0.05, ...settle }, cardsAt);
      tl.from(
        [".score__meta", ".score__actions"],
        { y: 6, opacity: 0, duration: 0.3, stagger: 0.05, ...settle },
        cardsAt + 0.15,
      );
    },
    [result, perfect, percentText, reduceMotion],
  );

  const visible = useMemo(() => {
    if (filter === "all") return result.entries;
    return result.entries.filter((entry) => entry.outcome === filter);
  }, [filter, result.entries]);

  // "Missed" for the primary action means anything that did not score: wrong answers
  // first, and skipped questions if there were no wrong ones. A perfect run has nothing to
  // review in that sense, so the button falls back to the full list.
  const missedFilter: Filter =
    result.incorrect > 0 ? "incorrect" : result.unanswered > 0 ? "unanswered" : "all";
  const hasMissed = missedFilter !== "all";

  function goToReview(nextFilter: Filter) {
    setFilter(nextFilter);
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
    ["incorrect", "Missed", result.incorrect],
    ["unanswered", "Unanswered", result.unanswered],
  ];

  return (
    <div className="container container--reading results">
      <section
        className={`score${perfect ? " score--perfect" : ""}`}
        aria-labelledby="score-heading"
        ref={scoreRef}
      >
        <span className="score__badge" aria-hidden="true">
          <IconTrophy size={28} />
        </span>
        <h1 id="score-heading" className="score__title">
          Quiz complete!
        </h1>
        <p className="score__eyebrow">{perfect ? "Perfect score" : "Your score"}</p>

        <p className="score__raw">
          <span className="score__visual" aria-hidden="true">
            {result.correct}
            <span className="score__of"> / {result.total}</span>
          </span>
          <span className="visually-hidden">
            {result.correct} out of {result.total} correct
          </span>
        </p>
        <p className="score__percent">
          <span className="score__percent-inner">
            {perfect && <span className="score__sweep" aria-hidden="true" />}
            {/* The visible figure counts up; the hidden copy always carries the real value
                so assistive technology never reads a number mid-count. */}
            <span className="score__percent-value" ref={percentRef} aria-hidden="true">
              {percentText}
            </span>
            <span className="visually-hidden">{percentText}</span>
            {perfect && !reduceMotion && (
              <span className="score__burst" aria-hidden="true">
                {SPARKS.map((kind, index) => (
                  <span key={index} className={`score__spark score__spark--${kind}`} />
                ))}
              </span>
            )}
          </span>
        </p>

        <dl className="result-cards">
          <div className="result-card result-card--correct">
            <dt>Correct</dt>
            <dd>{result.correct}</dd>
          </div>
          <div className="result-card result-card--incorrect">
            <dt>Missed</dt>
            <dd>{result.incorrect}</dd>
          </div>
          <div className="result-card result-card--unanswered">
            <dt>Unanswered</dt>
            <dd>{result.unanswered}</dd>
          </div>
          <div className="result-card result-card--accuracy">
            <dt>Accuracy</dt>
            <dd>{formatPercent(result.percent)}</dd>
          </div>
        </dl>

        <p className="score__meta">
          {sourceName} · Attempt {attemptNumber}
        </p>

        <div className="score__actions">
          <button
            type="button"
            className="btn btn--primary btn--lg"
            onClick={() => goToReview(missedFilter)}
          >
            {hasMissed ? "Review missed questions" : "Review answers"}
          </button>
          <button type="button" className="btn btn--secondary btn--lg" onClick={onRetake}>
            <IconRefresh size={18} /> Take it again
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
              {REVIEW_TITLE[filter]}
            </h2>
            <p className="review__intro">
              In the order you saw them. Taking the quiz again reshuffles.
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
            {visible.map((entry, position) => (
              <ReviewCard
                key={entry.questionId}
                entry={entry}
                position={position + 1}
                count={visible.length}
              />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function ReviewCard({
  entry,
  position,
  count,
}: {
  entry: ReviewEntry;
  position: number;
  count: number;
}) {
  const { label, Icon } = OUTCOME[entry.outcome];

  return (
    <li className={`review-item review-item--${entry.outcome}`}>
      <div className="review-item__head">
        <span className="outcome">
          <Icon size={16} /> {label}
        </span>
        <span className="review-item__where">
          <span className="review-item__number">Question {entry.displayNumber}</span>
          <span className="review-item__position">
            {position} of {count}
          </span>
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
