import { useId, useMemo, useState } from "react";
import { IconArrowRight, IconCheck, IconFile } from "./Icons";
import { isQuestionLimit, type AttemptOptions } from "../lib/attempt";
import { summarizeChoiceShape, totalChoices } from "../lib/choices";
import { quizTitleFromFileName } from "../lib/display";
import type { SourceQuestion } from "../lib/types";

/** Quiz-length presets. Only those shorter than the file are offered, plus "All". */
const LENGTH_PRESETS = [5, 10, 15, 20, 30, 50];

/**
 * The setup state, shown once a file has validated and before the quiz starts.
 *
 * Deliberately plain: the file, three facts about it, two options, and one big button.
 * Nothing here mentions JSON, distractors, or any other authoring detail — that belongs in
 * the format guide on the landing page.
 */
export function SetupScreen({
  fileName,
  questions,
  onStart,
  onChangeFile,
}: {
  fileName: string;
  questions: SourceQuestion[];
  onStart: (options: AttemptOptions) => void;
  onChangeFile: () => void;
}) {
  const [shuffleQuestions, setShuffleQuestions] = useState(true);
  // 0 means "every question"; anything else is a preset that is shorter than the file.
  const [limit, setLimit] = useState(0);
  const shuffleId = useId();
  const lengthId = useId();

  const total = questions.length;
  const shape = useMemo(() => summarizeChoiceShape(questions), [questions]);
  const presets = LENGTH_PRESETS.filter((count) => count < total);
  const count = isQuestionLimit(limit, total) ? limit : total;

  const choicesLabel = shape
    ? shape.uniform
      ? `${totalChoices(shape.minDistractors)} per question`
      : `${totalChoices(shape.minDistractors)}–${totalChoices(shape.maxDistractors)} per question`
    : "";

  return (
    <section className="setup" aria-labelledby="ready-title">
      <div className="setup__card">
        <div className="setup__head">
          <span className="ready__badge" aria-hidden="true">
            <IconCheck size={24} className="ready__check" />
          </span>
          <div className="setup__intro">
            <p className="ready__eyebrow" id="ready-title">
              Ready to begin
            </p>
            <h1 className="ready__title">{quizTitleFromFileName(fileName)}</h1>
            <p className="ready__file">
              <IconFile size={15} />
              <span>{fileName}</span>
              <span className="ready__file-status">· loaded successfully</span>
            </p>
          </div>
        </div>

        <dl className="stats" aria-label="Quiz summary">
          <div className="stat">
            <dt>Questions</dt>
            <dd>
              {count}
              {count !== total && <span className="stat__of"> of {total}</span>}
            </dd>
          </div>
          <div className="stat">
            <dt>Answer choices</dt>
            <dd>{choicesLabel}</dd>
          </div>
          <div className="stat">
            <dt>Order</dt>
            <dd>{shuffleQuestions ? "Randomized" : "As written"}</dd>
          </div>
        </dl>

        <fieldset className="options">
          <legend className="options__legend">Options</legend>

          <div className="option">
            <label className="option__label" htmlFor={shuffleId}>
              <span className="option__title">Shuffle question order</span>
              <span className="option__hint">A fresh random order every time you start.</span>
            </label>
            <input
              id={shuffleId}
              className="switch"
              type="checkbox"
              role="switch"
              checked={shuffleQuestions}
              onChange={(event) => setShuffleQuestions(event.target.checked)}
            />
          </div>

          {presets.length > 0 && (
            <div className="option">
              <label className="option__label" htmlFor={lengthId}>
                <span className="option__title">Number of questions</span>
                <span className="option__hint">
                  A shorter quiz is a random sample of the file.
                </span>
              </label>
              <select
                id={lengthId}
                className="select"
                value={limit}
                onChange={(event) => setLimit(Number(event.target.value))}
              >
                <option value={0}>All ({total})</option>
                {presets.map((preset) => (
                  <option key={preset} value={preset}>
                    {preset}
                  </option>
                ))}
              </select>
            </div>
          )}
        </fieldset>

        <p className="ready__note">
          Answer choices are always shuffled, so the correct answer never sits in the same spot.
        </p>

        <div className="ready__actions">
          <button
            type="button"
            className="btn btn--primary btn--xl"
            onClick={() =>
              onStart(
                count === total ? { shuffleQuestions } : { shuffleQuestions, limit: count },
              )
            }
          >
            Start quiz <IconArrowRight size={18} />
          </button>
          <button type="button" className="btn btn--quiet" onClick={onChangeFile}>
            Choose a different file
          </button>
        </div>
      </div>
    </section>
  );
}
