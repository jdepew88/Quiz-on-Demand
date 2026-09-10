# Quiz on Demand

Upload a JSON quiz file, take it in a freshly randomized order, and get a score plus a
question-by-question review.

No account. No database. No backend. **Your quiz file never leaves your browser.**

It works for any subject — a teacher's vocabulary list, a certification study deck, a pub
quiz, onboarding material at work, or twenty questions you wrote yourself five minutes ago.

---

## Contents

1. [What it does](#1-what-it-does)
2. [Run it locally](#2-run-it-locally)
3. [JSON schema](#3-json-schema)
4. [Example JSON](#4-example-json)
5. [How question randomization works](#5-how-question-randomization-works)
6. [Privacy behaviour](#6-privacy-behaviour)
7. [Build it](#7-build-it)
8. [Deploy it to Cloudflare](#8-deploy-it-to-cloudflare)
9. [Where the sample JSON lives](#9-where-the-sample-json-lives)
10. [Project layout](#10-project-layout)
11. [Tests](#11-tests)

---

## 1. What it does

| Screen | What you get |
| --- | --- |
| **Upload** | Drag-and-drop or a file picker, the schema explained on the page, a copyable example, downloadable template and sample files, full validation with per-question error messages, and a count of valid questions. |
| **Quiz** | One question at a time with four choices, a progress bar, answered/remaining counts, Previous / Next, a jump-to-any-question navigator, an "unanswered" marker, and Submit. Answers can be changed until you submit. |
| **Confirm** | If anything is unanswered, it tells you how many and lets you go back or submit anyway. |
| **Results** | Raw score, percentage, and the correct / incorrect / unanswered split — e.g. **42 / 50 — 84%**. |
| **Review** | Every question with your answer, the correct answer, and a clear correct / incorrect / unanswered marker. Filterable to just the ones you missed or skipped. |
| **Restart** | *Take again (reshuffle)* for a brand new order of the same questions, or *Upload new quiz* to start over. |

Every question has exactly **one correct answer and three distractors**, so every question
shows four choices.

Accessibility is built in rather than bolted on: real radio groups inside a labelled
`fieldset` (so arrow keys work), a skip link, visible focus rings, focus moved to the
question when you navigate and to the new screen when the phase changes, semantic
landmarks and headings, live progress exposed via `role="progressbar"`, and correct /
incorrect never signalled by colour alone. Light and dark themes both follow the OS
setting, and the layout works from ~320px up.

---

## 2. Run it locally

Requires Node 20.19+ (Node 22 recommended).

```bash
npm install
npm run dev
```

Then open the URL Vite prints — by default <http://localhost:5173>.

**The local development command is `npm run dev`.**

| Command | What it does |
| --- | --- |
| `npm run dev` | Vite dev server with hot reload. This is the one you want day to day. |
| `npm run build` | Type-check, then produce the production bundle in `dist/`. |
| `npm run preview` | Serve the built `dist/` with Vite, to sanity-check a production build. |
| `npm run cf:dev` | Serve the built `dist/` through the real Cloudflare Workers runtime (`wrangler dev`). Run `npm run build` first. |
| `npm test` | Run the test suite once. |
| `npm run test:watch` | Run tests in watch mode. |
| `npm run lint` | ESLint over the whole project. |
| `npm run typecheck` | `tsc --noEmit`. |
| `npm run deploy` | Build, then deploy to Cloudflare Workers. |

---

## 3. JSON schema

A quiz file is a **JSON array**. Each entry is one question object.

| Property | Type | Required | Notes |
| --- | --- | --- | --- |
| `question` | `string` | **yes** | The question text. Must not be blank. |
| `answer` | `string` | **yes** | The single correct choice. Must not be blank. |
| `distractors` | `string[]` | **yes** | Exactly **three** incorrect choices, none blank. |
| `explanation` | `string` | no | Optional. Shown on the review screen after you submit. |

Unknown properties are ignored, so you can keep your own metadata (`category`,
`difficulty`, whatever) in the file without breaking anything.

### Validation rules

A file is either accepted whole or rejected whole — **malformed questions are never
silently dropped**. Every problem found is reported at once, each naming the question
number it belongs to. The following are caught:

- invalid JSON syntax (with the parser's position detail) and empty files
- a root value that is not an array
- an empty quiz
- an entry that is not an object
- missing `question`, `answer`, or `distractors`
- a wrong type for any of them (reported with the type actually found)
- a blank question, answer, or distractor
- `distractors` that is not an array
- fewer or more than three distractors
- the correct answer duplicated among the distractors
- two distractors that are the same choice

Duplicate detection ignores case and surrounding whitespace, so `"Paris"` and `"  paris "`
are treated as the same choice.

### Getting a starting file

On the upload page:

- **Download template JSON** → a minimal file to fill in
- **Download sample quiz** → a working 20-question general-knowledge quiz
- **Try the sample quiz** → loads that sample straight into the app

---

## 4. Example JSON

```json
[
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
]
```

With the optional explanation:

```json
[
  {
    "question": "Which planet is closest to the Sun?",
    "answer": "Mercury",
    "distractors": ["Venus", "Mars", "Earth"],
    "explanation": "Mercury orbits at roughly 58 million km from the Sun. Venus is second."
  }
]
```

Any reasonable number of questions is fine — 5 or 500. There is no fixed quiz length.

---

## 5. How question randomization works

The uploaded file is the **source**, and it is treated as immutable for the whole session.
Nothing sorts it, rewrites it, or grades against it. Starting a quiz builds a separate
**in-memory attempt** from it.

Two independent shuffles happen when an attempt is built
([`src/lib/attempt.ts`](src/lib/attempt.ts)):

1. **Question order** — the primary randomization. So a 30-question file might be presented
   as question 17, then 3, then 29, then 1, then 8, and so on.
2. **Answer-choice order** within each question, so the correct answer does not sit in the
   same slot every time.

Both use an unbiased **Fisher–Yates** shuffle ([`src/lib/shuffle.ts`](src/lib/shuffle.ts))
that copies rather than mutating. Deliberately *not* `items.sort(() => Math.random() - 0.5)`
— an inconsistent comparator skews heavily toward near-identity orderings, and the test
suite checks that all six permutations of a three-element array come up in roughly equal
proportion, which that approach fails.

**Scoring cannot be broken by either shuffle**, because answers are recorded against a
question id, never against a position:

- Each attempt question gets an id like `a1-q7` (attempt 1, display slot 7).
- Choice ids are assigned **after** the choices are shuffled (`a1-q7-c0` … `-c3`), so an id
  can never be used to work out which choice is correct.
- `correctChoiceId` is resolved after the shuffle by finding where the correct text actually
  landed.

The original question number from your file is kept internally for integrity checks only —
it is never rendered, so the quiz does not reveal which question you are on in the source
file. Review numbering reflects the order you actually saw.

**Take again (reshuffle)** builds a brand new attempt from the same untouched source, with a
new order, new choice positions, and new ids — which also means a stale selection from the
previous attempt can never be scored against the new one. **Upload new quiz** clears
everything.

---

## 6. Privacy behaviour

> **Your quiz file is processed locally in your browser and is not uploaded or stored.**

This is a property of the architecture, not a policy promise:

- There is **no Worker script** — `wrangler.toml` declares only `[assets]`, so the deployment
  is static files and nothing else.
- The only thing that ever reads your file is `File.text()` in the browser
  ([`src/components/UploadScreen.tsx`](src/components/UploadScreen.tsx)). Parsing, validation,
  shuffling, and grading are all client-side pure functions.
- Nothing is persisted: no account, no database, no cookies, no `localStorage`, no analytics.
  Closing the tab ends the session and the quiz is gone.
- The single network request the app makes on its own is fetching `/sample-quiz.json` — its
  own static sample file — when you click *Try the sample quiz*.

The statement above is shown in the UI on both the upload and results screens.

---

## 7. Build it

```bash
npm run build
```

This runs `tsc --noEmit` and then `vite build`, producing `dist/`:

```
dist/
├─ index.html
├─ favicon.svg
├─ sample-quiz.json
├─ quiz-template.json
└─ assets/
   ├─ index-<hash>.js
   └─ index-<hash>.css
```

To check the build against the real Workers runtime before deploying:

```bash
npm run build
npm run cf:dev
```

---

## 8. Deploy it to Cloudflare

The app is a **static-assets-only Cloudflare Worker**. There is no server-side code, so
there is nothing to configure beyond the assets directory.

**The deployment command is:**

```bash
npm run deploy
```

which is `npm run build && wrangler deploy`.

First time on a new machine or account, authenticate once:

```bash
npx wrangler login
```

Then `npm run deploy` creates the Worker (named `quiz-on-demand`, from `wrangler.toml`) and
uploads `dist/`. It will be served at `https://quiz-on-demand.<your-subdomain>.workers.dev`,
and you can attach a custom domain from the Cloudflare dashboard afterwards.

To verify the configuration without deploying anything:

```bash
npm run build
npx wrangler deploy --dry-run
```

### Why `wrangler.toml`, and why Workers rather than Pages

- **`wrangler.toml` is used**, as requested — current Wrangler accepts TOML for this
  configuration, so no alternative format was needed. (Wrangler also accepts `wrangler.jsonc`;
  either is valid. TOML was chosen for readability.)
- **Workers Static Assets** rather than Cloudflare Pages. Both would host this app for free,
  but Workers static assets is the platform Cloudflare now points new static projects at,
  and it gives a single deploy command with no separate Pages project to create. The whole
  configuration is:

  ```toml
  name = "quiz-on-demand"
  compatibility_date = "2025-09-01"

  [assets]
  directory = "./dist"
  not_found_handling = "single-page-application"
  ```

  `not_found_handling = "single-page-application"` makes unknown paths serve `index.html`
  instead of a 404, so deep links and refreshes work.

If you would rather use Pages, `dist/` is a plain static directory and
`npx wrangler pages deploy dist` will publish it as-is.

Nothing has been deployed and no GitHub repository has been created — both are left to you.

---

## 9. Where the sample JSON lives

| File | Purpose |
| --- | --- |
| [`public/sample-quiz.json`](public/sample-quiz.json) | A working 20-question general-knowledge quiz. Served at `/sample-quiz.json`, linked from the upload page, and loaded by *Try the sample quiz*. |
| [`public/quiz-template.json`](public/quiz-template.json) | A minimal two-question template to fill in. Served at `/quiz-template.json`. |

Both are checked by the test suite against the app's own validator, so a broken template
cannot ship.

---

## 10. Project layout

```
quiz-on-demand/
├─ index.html                    # Vite entry document
├─ wrangler.toml                 # Cloudflare Workers static-assets config
├─ vite.config.ts                # Build + Vitest config
├─ eslint.config.js
├─ tsconfig.json
├─ public/
│  ├─ sample-quiz.json           # 20-question sample quiz
│  ├─ quiz-template.json         # Fill-in template
│  └─ favicon.svg
└─ src/
   ├─ main.tsx                   # React entry
   ├─ App.tsx                    # Session state and phase routing
   ├─ index.css                  # Design tokens + all styles (light/dark)
   ├─ lib/
   │  ├─ types.ts                # SourceQuestion vs AttemptQuestion
   │  ├─ validation.ts           # Parsing + all validation rules
   │  ├─ shuffle.ts              # Fisher–Yates
   │  ├─ attempt.ts              # Attempt building, grading, scoring
   │  ├─ validation.test.ts
   │  ├─ shuffle.test.ts
   │  └─ attempt.test.ts
   ├─ components/
   │  ├─ UploadScreen.tsx        # Drop zone, file picker, validation results
   │  ├─ FormatGuide.tsx         # On-page schema docs, example, downloads
   │  ├─ QuizScreen.tsx          # Question, choices, navigation, navigator
   │  ├─ ConfirmSubmitDialog.tsx # Unanswered warning
   │  ├─ ResultsScreen.tsx       # Score, stats, review list, restart
   │  └─ PrivacyNote.tsx
   └─ test/
      ├─ setup.ts
      ├─ app.test.tsx            # Full user-journey tests
      └─ fixtures.test.ts        # Shipped JSON files must validate
```

---

## 11. Tests

```bash
npm test
```

104 tests across 5 files, covering:

- **Validation** — valid files, malformed JSON, a non-array root, an empty quiz, missing
  fields, wrong types, blank values, wrong distractor counts, the answer duplicated among
  distractors, duplicate distractors, correct question numbering in messages, all problems
  collected in one pass, and that nothing is returned alongside issues (nothing silently
  discarded).
- **Shuffle** — no mutation of the input, every element preserved exactly once, correct
  behaviour at the rng boundaries, and a statistical check that the permutation distribution
  is uniform.
- **Attempts and scoring** — question-order randomization, choice-order randomization,
  `correctChoiceId` tracking through both shuffles, ids that do not leak the answer, perfect
  and zero scores, the 42/50 = 84% worked example, unanswered questions counted separately
  from incorrect ones, scoring independent of display position, stale selections from a
  previous attempt ignored, reshuffle correctness across repeated attempts, and percentage
  rounding.
- **User journeys** (`src/test/app.test.tsx`) — the whole flow against the real components:
  upload and validation feedback, taking the quiz, changing answers, navigation, the
  unanswered-submission warning and its escape routes, results, the review screen's
  correct/incorrect/unanswered distinction, filters, reshuffling, and quiz reset.
- **Shipped fixtures** — `public/sample-quiz.json`, `public/quiz-template.json`, and the
  example printed on the upload page all validate and produce a playable, gradeable attempt.

- **Accessibility scaffolding** — the skip link, a top-level heading on every screen, the
  four choices grouped under the question, choice labels that are the answer text alone, and
  focus moving to the question on navigation and into the new screen on submit (without
  stealing focus on first load).

Because question order is randomized on purpose, the journey tests never assume which
question is on screen — they read the visible question and look up its answer, which
doubles as a standing check that grading survives randomization.

---

## Dependency notes

`package.json` carries one `overrides` entry:

```json
"overrides": { "sharp": "^0.35.4" }
```

`sharp` arrives transitively via `wrangler` → `miniflare`, and the version Wrangler pins
carries a published advisory. The override lifts it to the patched release; `npm audit`
reports zero vulnerabilities with it in place. It affects local tooling only — `sharp` is
never part of the deployed bundle. Remove it once Wrangler ships a newer `miniflare`.
