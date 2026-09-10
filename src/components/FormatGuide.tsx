import { REQUIRED_DISTRACTORS } from "../lib/validation";

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
          A quiz is a JSON array. Every entry is one question with exactly one correct answer
          and exactly {REQUIRED_DISTRACTORS} wrong answers, so every question shows four
          choices.
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
              <td>Exactly {REQUIRED_DISTRACTORS} incorrect choices.</td>
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
          <li>The top level must be an array — start the file with <code>[</code>.</li>
          <li>Every question needs all three required properties, and none may be blank.</li>
          <li>
            <code>distractors</code> must contain exactly {REQUIRED_DISTRACTORS} entries.
          </li>
          <li>All four choices must be different from each other.</li>
          <li>Any number of questions is fine — 5 or 500.</li>
        </ul>
      </div>

      <div>
        <h3 style={{ fontSize: "0.95rem", marginBottom: "0.4rem" }}>Example</h3>
        <pre className="code">
          <code>{EXAMPLE_JSON}</code>
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
