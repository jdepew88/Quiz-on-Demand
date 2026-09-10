import type { ReactNode } from "react";
import { IconDownload } from "./Icons";
import {
  MAX_CHOICES,
  MAX_DISTRACTORS,
  MIN_CHOICES,
  MIN_DISTRACTORS,
  RECOMMENDED_CHOICES,
  RECOMMENDED_DISTRACTORS,
} from "../lib/choices";

/**
 * The quiz-file format guide.
 *
 * Visually subordinate to using the app: it sits below the upload area, leads with three
 * plain-language terms and one example, and keeps the full field reference behind a
 * disclosure. Written for someone who has never opened a JSON file.
 *
 * Wording rule: a **distractor** is an incorrect choice, the **correct answer** is the one
 * right choice, and **total choices** is the two added together. "Answers" on its own is
 * never used for the incorrect ones — it is the ambiguity that makes a schema hard to read.
 */

/** Shown verbatim on the upload page so a quiz can be written without reading the README. */
export const EXAMPLE_JSON = `[
  {
    "question": "What is the capital of France?",
    "answer": "Paris",
    "distractors": [
      "London",
      "Berlin",
      "Madrid"
    ]
  },
  {
    "question": "What is 2 + 2?",
    "answer": "4",
    "distractors": [
      "3",
      "5",
      "6"
    ]
  }
]`;

/** A second, shorter example proving the count is not fixed at three. */
export const SHORT_EXAMPLE_JSON = `{
  "question": "What is 2 + 2?",
  "answer": "4",
  "distractors": [
    "3",
    "5"
  ]
}`;

/** Static files served from /public. Both are plain downloads — no JavaScript required. */
export const TEMPLATE_FILE = "/quiz-template.json";
export const SAMPLE_FILE = "/sample-quiz.json";

/** Colour JSON keys and string values; punctuation stays plain. Text content is unchanged. */
function highlightJson(source: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let cursor = 0;

  for (const match of source.matchAll(/"(?:[^"\\]|\\.)*"(\s*:)?/g)) {
    const start = match.index ?? 0;
    if (start > cursor) nodes.push(source.slice(cursor, start));

    const colon = match[1] ?? "";
    const token = match[0].slice(0, match[0].length - colon.length);
    nodes.push(
      <span key={start} className={colon ? "tok-key" : "tok-string"}>
        {token}
      </span>,
    );
    if (colon) nodes.push(colon);
    cursor = start + match[0].length;
  }

  nodes.push(source.slice(cursor));
  return nodes;
}

function JsonBlock({ source }: { source: string }) {
  // Focusable so keyboard users can scroll it if a narrow screen makes it overflow.
  return (
    <pre className="code" tabIndex={0}>
      <code>{highlightJson(source)}</code>
    </pre>
  );
}

export function FormatGuide() {
  return (
    <section id="format-guide" className="guide" aria-labelledby="format-heading">
      <header className="guide__header">
        <p className="eyebrow">Write your own</p>
        <h2 id="format-heading" className="section-title">
          Quiz file format
        </h2>
        <p className="guide__intro">
          A quiz is a plain-text JSON file — a list of questions, each with its correct answer and
          a few wrong ones. Any text editor can make one.
        </p>
      </header>

      <dl className="terms">
        <div className="term">
          <dt>Correct answer</dt>
          <dd>
            The one right choice. It goes in <code>answer</code>.
          </dd>
        </div>
        <div className="term">
          <dt>Distractors</dt>
          <dd>
            Distractors are incorrect answer choices. List {MIN_DISTRACTORS} to {MAX_DISTRACTORS} of
            them in <code>distractors</code>.
          </dd>
        </div>
        <div className="term">
          <dt>Total choices</dt>
          <dd>Total choices = 1 correct answer + distractors. That is what appears on screen.</dd>
        </div>
      </dl>

      <p className="formula">
        <span className="formula__term">{RECOMMENDED_DISTRACTORS} distractors</span>{" "}
        <span className="formula__op">+</span>{" "}
        <span className="formula__term">1 correct answer</span>{" "}
        <span className="formula__op">=</span>{" "}
        <span className="formula__term formula__term--result">{RECOMMENDED_CHOICES} total choices</span>{" "}
        <span className="formula__tag">Recommended</span>
      </p>
      <p className="guide__note">
        Recommended, not required: a question may list {MIN_DISTRACTORS}–{MAX_DISTRACTORS}{" "}
        distractors ({MIN_CHOICES}–{MAX_CHOICES} total choices), and questions in the same quiz can
        differ.
      </p>

      <figure className="example">
        <figcaption className="example__caption">
          <span>Example quiz file</span>
          <a className="text-link" href={SAMPLE_FILE} download="sample-quiz.json">
            <IconDownload size={16} /> Download sample quiz
          </a>
        </figcaption>
        <JsonBlock source={EXAMPLE_JSON} />
      </figure>

      <details className="more">
        <summary className="more__summary">
          <span>Every field, the rules, and a shorter example</span>
          <span className="more__chevron" aria-hidden="true" />
        </summary>

        <div className="more__body">
          <h3 className="more__heading">Fields</h3>
          <dl className="fields">
            <div className="field">
              <dt>
                <code>question</code> <span className="field__tag">Required</span>
              </dt>
              <dd>The question text shown to the person taking the quiz.</dd>
            </div>
            <div className="field">
              <dt>
                <code>answer</code> <span className="field__tag">Required</span>
              </dt>
              <dd>The one correct choice.</dd>
            </div>
            <div className="field">
              <dt>
                <code>distractors</code> <span className="field__tag">Required</span>
              </dt>
              <dd>
                A list of {MIN_DISTRACTORS}–{MAX_DISTRACTORS} incorrect choices. How many you list
                is how many that question shows — there is no count to set.
              </dd>
            </div>
            <div className="field">
              <dt>
                <code>explanation</code>{" "}
                <span className="field__tag field__tag--optional">Optional</span>
              </dt>
              <dd>A note shown when reviewing answers after you submit.</dd>
            </div>
          </dl>

          <h3 className="more__heading">Rules</h3>
          <ul className="rules">
            <li>
              The file is a list: it starts with <code>[</code> and ends with <code>]</code>.
            </li>
            <li>
              Every question needs <code>question</code>, <code>answer</code>, and{" "}
              <code>distractors</code>, and none of them may be blank.
            </li>
            <li>Every choice in a question must be different — including the correct answer.</li>
            <li>Any number of questions works — 5 or 500.</li>
            <li>
              If anything is wrong, nothing is skipped: you get every problem, listed by question
              number.
            </li>
          </ul>

          <h3 className="more__heading">A question with fewer choices</h3>
          <p className="more__text">
            List two distractors and the question shows {MIN_CHOICES} choices:
          </p>
          <JsonBlock source={SHORT_EXAMPLE_JSON} />
        </div>
      </details>
    </section>
  );
}
