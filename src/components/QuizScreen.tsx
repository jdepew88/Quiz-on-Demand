import { gsap } from "gsap";
import { useCallback, useEffect, useRef, useState, type ChangeEvent } from "react";
import { ConfirmSubmitDialog } from "./ConfirmSubmitDialog";
import { IconArrowLeft, IconArrowRight, IconCheck } from "./Icons";
import { QuizTimer } from "./QuizTimer";
import { countAnswered } from "../lib/attempt";
import { choiceLabel } from "../lib/choices";
import { EASE_OUT, navigationDirection, prefersReducedMotion, useGsapContext } from "../lib/motion";
import { deadline, isExpired, type QuizTiming } from "../lib/timing";
import { useNow } from "../lib/useNow";
import type { QuizAttempt, Selections } from "../lib/types";

/**
 * Up to this many questions the progress indicator is one segment per question; beyond it
 * the segments would be too thin to read, so a continuous bar takes over.
 */
const MAX_PROGRESS_SEGMENTS = 40;

/**
 * Question transition: the outgoing question fades a few pixels in the direction of travel,
 * React swaps the content, and the incoming one fades in from the opposite side with the
 * answer rows a beat behind. Fast enough that the user is never waiting on it.
 */
const EXIT_DISTANCE = 14;
const ENTER_DISTANCE = 18;
const EXIT_DURATION = 0.14;
const ENTER_DURATION = 0.22;
const CHOICE_STAGGER = 0.025;

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
  timing,
  onSelect,
  onActivate,
  onSubmit,
  onExpire,
  onExit,
}: {
  attempt: QuizAttempt;
  selections: Selections;
  timing: QuizTiming;
  onSelect: (questionId: string, choiceId: string) => void;
  /** The question now on screen; the clock starts a segment for it. */
  onActivate: (questionId: string) => void;
  onSubmit: () => void;
  /** The time limit ran out. Called once; the parent freezes the clock and grades. */
  onExpire: () => void;
  onExit: () => void;
}) {
  const [index, setIndex] = useState(0);
  const [confirming, setConfirming] = useState(false);
  const promptRef = useRef<HTMLLegendElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  // Only move focus for a deliberate navigation, never on first paint — otherwise the
  // page would yank focus away the moment the quiz opens.
  const shouldFocusPrompt = useRef(false);
  // The exit tween in flight, if any, and the question it is heading for. React's index
  // only changes once the exit has finished (or been cut short by another navigation).
  const exitTween = useRef<gsap.core.Tween | null>(null);
  const pendingIndex = useRef<number | null>(null);
  // Which way the question just changed, read by the enter animation: 0 on first paint.
  const enterDirection = useRef<-1 | 0 | 1>(0);

  useEffect(() => {
    if (shouldFocusPrompt.current) {
      shouldFocusPrompt.current = false;
      promptRef.current?.focus();
    }
  }, [index]);

  const goTo = useCallback(
    (next: number) => {
      const target = Math.min(Math.max(next, 0), attempt.questions.length - 1);
      // Navigating again mid-transition: drop the half-finished exit and jump straight to
      // the newest target, so rapid Next presses land where the user expects.
      const from = pendingIndex.current ?? index;
      if (target === from) return;
      const direction = navigationDirection(index, target);
      shouldFocusPrompt.current = true;

      const inner = cardRef.current?.querySelector<HTMLElement>(".question-card__inner");
      if (exitTween.current || prefersReducedMotion() || !inner) {
        exitTween.current?.kill();
        exitTween.current = null;
        pendingIndex.current = null;
        if (target === index) {
          // Reversed mid-exit back to the question still on screen: bring it back.
          if (inner) gsap.to(inner, { x: 0, opacity: 1, duration: 0.12, clearProps: "transform,opacity" });
          return;
        }
        enterDirection.current = prefersReducedMotion() ? 0 : direction;
        setIndex(target);
        return;
      }

      pendingIndex.current = target;
      exitTween.current = gsap.to(inner, {
        x: -EXIT_DISTANCE * direction,
        opacity: 0,
        duration: EXIT_DURATION,
        ease: "power1.in",
        onComplete: () => {
          exitTween.current = null;
          pendingIndex.current = null;
          enterDirection.current = direction;
          setIndex(target);
        },
      });
    },
    [attempt.questions.length, index],
  );

  // Previous/Next count from where the user is *heading*, not where React still is, so two
  // quick presses advance two questions.
  const step = useCallback(
    (delta: -1 | 1) => goTo((pendingIndex.current ?? index) + delta),
    [goTo, index],
  );

  useEffect(
    () => () => {
      exitTween.current?.kill();
    },
    [],
  );

  // Enter: the new question (a fresh keyed element) settles in from the direction of
  // travel, then its answer rows follow with a tiny stagger. Skipped on first paint, when
  // no navigation has set a direction yet. The direction is deliberately not consumed
  // here: this effect only re-runs for a new index (always preceded by goTo) or for React
  // Strict Mode's development rehearsal, which should replay the same entrance.
  useGsapContext(
    cardRef,
    (card) => {
      const direction = enterDirection.current;
      if (direction === 0 || prefersReducedMotion()) return;

      const inner = card.querySelector<HTMLElement>(".question-card__inner");
      if (!inner) return;
      inner.dataset.direction = direction > 0 ? "next" : "previous";

      const tl = gsap.timeline({ defaults: { ease: EASE_OUT, clearProps: "transform,opacity" } });
      tl.from(inner, { x: ENTER_DISTANCE * direction, opacity: 0, duration: ENTER_DURATION }).from(
        inner.querySelectorAll(".choice"),
        { y: 6, opacity: 0, duration: 0.2, stagger: CHOICE_STAGGER },
        0.05,
      );

      // The current progress segment fills from the left rather than snapping.
      const segment = progressRef.current?.querySelector(".progress__segment--current");
      if (segment) {
        tl.from(segment, { scaleX: 0.35, transformOrigin: "left center", duration: 0.3 }, 0);
      }
    },
    [index],
  );

  // Selection feedback on top of the CSS state: the row and its letter badge give the
  // smallest possible press response. Keyboard selection gets the same.
  function handleSelect(event: ChangeEvent<HTMLInputElement>, questionId: string, choiceId: string) {
    onSelect(questionId, choiceId);
    if (prefersReducedMotion()) return;
    const row = event.currentTarget.closest<HTMLElement>(".choice");
    const letter = row?.querySelector<HTMLElement>(".choice__letter");
    if (!row || !letter) return;
    gsap.fromTo(
      row,
      { scale: 0.985 },
      { scale: 1, duration: 0.25, ease: EASE_OUT, overwrite: "auto", clearProps: "transform" },
    );
    gsap.fromTo(
      letter,
      { scale: 0.85 },
      { scale: 1, duration: 0.3, ease: EASE_OUT, overwrite: "auto", clearProps: "transform" },
    );
  }

  const total = attempt.questions.length;
  const question = attempt.questions[index];
  const answered = countAnswered(attempt, selections);

  // Per-question timing follows the question on screen. The model ignores a repeat for
  // the question that is already active, so this is safe to run on every index change.
  const activeId = question?.id;
  useEffect(() => {
    if (activeId !== undefined) onActivate(activeId);
  }, [activeId, onActivate]);

  // The clock display refreshes twice a second; the figures themselves come from
  // timestamps, so a backgrounded tab catches up the moment it is looked at again.
  const now = useNow(timing.completedAt === null);

  // Expiry. A timeout is armed for the exact deadline, and every tick double-checks in
  // case the browser throttled it (or the device slept through it). Either way `onExpire`
  // fires once from here, and the parent ignores a repeat anyway.
  const expired = useRef(false);
  const expire = useCallback(() => {
    if (expired.current) return;
    expired.current = true;
    onExpire();
  }, [onExpire]);
  useEffect(() => {
    if (timing.completedAt !== null) return;
    if (isExpired(timing, now)) expire();
  }, [timing, now, expire]);
  useEffect(() => {
    const end = deadline(timing);
    if (end === null || timing.completedAt !== null) return;
    const id = window.setTimeout(() => {
      if (isExpired(timing, Date.now())) expire();
    }, Math.max(0, end - Date.now()) + 5);
    return () => window.clearTimeout(id);
  }, [timing, expire]);
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
            {/* "7 / 20" on screen; the words are for assistive technology. */}
            <span className="quiz-bar__count" aria-hidden="true">
              {index + 1}
              <span className="quiz-bar__slash"> / </span>
              {total}
            </span>
            <span className="visually-hidden">
              Question {index + 1} of {total}
            </span>
            <span className="quiz-bar__answered">
              {answered} answered · {unanswered} remaining
            </span>
          </p>
          <QuizTimer timing={timing} now={now} />
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

        <div className="container container--reading">
          <div
            ref={progressRef}
            className={`progress${total <= MAX_PROGRESS_SEGMENTS ? " progress--segmented" : ""}`}
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={total}
            aria-valuenow={answered}
            aria-valuetext={`${answered} of ${total} questions answered`}
            aria-label="Quiz progress"
          >
            {total <= MAX_PROGRESS_SEGMENTS ? (
              attempt.questions.map((item, itemIndex) => (
                <span
                  key={item.id}
                  className={[
                    "progress__segment",
                    selections[item.id] ? "progress__segment--done" : "",
                    itemIndex === index ? "progress__segment--current" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                />
              ))
            ) : (
              <div className="progress__fill" style={{ width: `${percentComplete}%` }} />
            )}
          </div>
        </div>
      </div>

      <div className="container container--reading quiz">
        <div className="question-card" ref={cardRef}>
          {/* Keyed on the question so each one mounts fresh; the enter animation above
              targets this element, so the change of question is felt, not just read in
              the progress bar. */}
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
                        onChange={(event) => handleSelect(event, question.id, choice.id)}
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
              onClick={() => step(-1)}
              disabled={index === 0}
            >
              <IconArrowLeft size={18} /> Previous
            </button>
            {isLast ? (
              <button
                type="button"
                className="btn btn--primary btn--lg"
                onClick={() => setConfirming(true)}
              >
                Submit quiz
              </button>
            ) : (
              <button
                type="button"
                className="btn btn--primary btn--lg"
                onClick={() => step(1)}
              >
                Next question <IconArrowRight size={18} />
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
