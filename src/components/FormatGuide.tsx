import {
  MAX_CHOICES,
  MAX_DISTRACTORS,
  MIN_CHOICES,
  MIN_DISTRACTORS,
  RECOMMENDED_CHOICES,
  RECOMMENDED_DISTRACTORS,
} from "../lib/choices";

/**
 * On-page schema documentation.
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

export function FormatGuide({ onLoadSample }: { onLoadSample: () => void }) {
  return (
    <section className="card stack" aria-labelledby="format-heading">
      <div>
        <h2 className="card__title" id="format-heading">
          Quiz file format
        </h2>
        <p className="muted small" style={{ marginTop: "0.35rem" }}>
          A quiz is a JSON array. Each entry is one question with one correct answer and a
          list of distractors.
        </p>
      </div>

      <div className="notice">
        <p>
          <strong>Distractors are incorrect answer choices.</strong>
        </p>
        <p style={{ marginTop: "0.3rem" }}>
          <strong>Total choices = 1 correct answer + distractors.</strong>
        </p>
        <p className="small muted" style={{ marginTop: "0.45rem" }}>
          {RECOMMENDED_DISTRACTORS} distractors + 1 correct answer = {RECOMMENDED_CHOICES} total
          choices is the recommended default. A question may supply anywhere from{" "}
          {MIN_DISTRACTORS} to {MAX_DISTRACTORS} distractors ({MIN_CHOICES}–{MAX_CHOICES} total
          choices), and different questions in the same quiz may use different counts.
        </p>
      </div>

      <div className="table-scroll">
        <table className="schema-table">
          <caption className="visually-hidden">Properties of a question object</caption>
          <thead>
            <tr>
              <th scope="col">Property</th>
              <th scope="col">Type</th>
              <th scope="col">Required</th>
              <th scope="col">Description</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <code>question</code>
              </td>
              <td>string</td>
              <td>Yes</td>
              <td>The question text shown to the person taking the quiz.</td>
            </tr>
            <tr>
              <td>
                <code>answer</code>
              </td>
              <td>string</td>
              <td>Yes</td>
              <td>The one correct choice.</td>
            </tr>
            <tr>
              <td>
                <code>distractors</code>
              </td>
              <td>string[]</td>
              <td>Yes</td>
              <td>
                The incorrect choices — {MIN_DISTRACTORS} to {MAX_DISTRACTORS} of them. How many
                you list is how many this question gets; there is no count field to set.
              </td>
            </tr>
            <tr>
              <td>
                <code>explanation</code>
              </td>
              <td>string</td>
              <td>No</td>
              <td>Optional note shown on the review screen after you submit.</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div>
        <h3 style={{ fontSize: "0.95rem", marginBottom: "0.4rem" }}>Rules</h3>
        <ul className="rules">
          <li>
            The top level must be an array — start the file with <code>[</code>.
          </li>
          <li>Every question needs all three required properties, and none may be blank.</li>
          <li>
            <code>distractors</code> must hold at least {MIN_DISTRACTORS} and at most{" "}
            {MAX_DISTRACTORS} entries.
          </li>
          <li>Every choice must be different — including the correct answer.</li>
          <li>Any number of questions is fine — 5 or 500.</li>
        </ul>
      </div>

      <div>
        <h3 style={{ fontSize: "0.95rem", marginBottom: "0.4rem" }}>Example</h3>
        <pre className="code">
          <code>{EXAMPLE_JSON}</code>
        </pre>
        <p className="small muted" style={{ marginTop: "0.5rem" }}>
          Both questions above use {RECOMMENDED_DISTRACTORS} distractors, so each shows{" "}
          {RECOMMENDED_CHOICES} choices. To offer fewer, list fewer — this question shows{" "}
          {MIN_CHOICES}:
        </p>
        <pre className="code" style={{ marginTop: "0.5rem" }}>
          <code>{SHORT_EXAMPLE_JSON}</code>
        </pre>
      </div>

      <div className="btn-row">
        <a className="btn btn--ghost" href={TEMPLATE_FILE} download="quiz-template.json">
          Download template JSON
        </a>
        <a className="btn btn--ghost" href={SAMPLE_FILE} download="sample-quiz.json">
          Download sample quiz
        </a>
        <button type="button" className="btn btn--secondary" onClick={onLoadSample}>
          Try the sample quiz
        </button>
      </div>
    </section>
  );
}
