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
| **Quiz** | One question at a time with all of its choices, a progress bar, answered/remaining counts, Previous / Next, a jump-to-any-question navigator, an "unanswered" marker, and Submit. Answers can be changed until you submit. |
| **Confirm** | If anything is unanswered, it tells you how many and lets you go back or submit anyway. |
| **Results** | Raw score, percentage, and the correct / incorrect / unanswered split — e.g. **42 / 50 — 84%**. |
| **Review** | Every question with your answer, the correct answer, and a clear correct / incorrect / unanswered marker. Filterable to just the ones you missed or skipped. |
| **Restart** | *Take again (reshuffle)* for a brand new order of the same questions, or *Upload new quiz* to start over. |

Every question has **one correct answer and 2–5 distractors**, so it shows 3–6 total
choices. Three distractors (four choices) is the recommended default, and questions in one
quiz may use different counts.

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
| `answer` | `string` | **yes** | The one **correct answer**. Must not be blank. |
| `distractors` | `string[]` | **yes** | The **incorrect** choices — 2 to 5 of them, none blank. |
| `explanation` | `string` | no | Optional. Shown on the review screen after you submit. |

Unknown properties are ignored, so you can keep your own metadata (`category`,
`difficulty`, whatever) in the file without breaking anything.

### Terminology

| Term | Meaning |
| --- | --- |
| **Correct answer** | The one choice that is actually correct — the `answer` field. |
| **Distractor** | An incorrect answer choice — one entry in `distractors`. |
| **Total choices** | The correct answer plus the distractors: `distractors.length + 1`. |

"Distractors" always means the *incorrect* choices. The count of them is never called
"number of answers", because that would be ambiguous about whether the correct one is
included.

### How many choices a question has

**The distractor count is simply `distractors.length`.** There is no count field to set and
no `distractorCount` property — the array already says how many there are, and a separate
number could only ever drift out of agreement with it.

| Distractors listed | Total choices rendered |
| --- | --- |
| 2 | 3 |
| **3** | **4** ← recommended standard format |
| 4 | 5 |
| 5 | 6 |

**Supported range: 2–5 distractors per question, giving 3–6 total choices per question.**

**3 distractors / 4 total choices is the recommended standard format**, and files written
that way need no changes of any kind — that was the only shape previously accepted, and it
still behaves exactly as it did.

**Different questions in the same quiz may use different valid distractor counts.** Nothing
requires a quiz to be uniform. This is a perfectly valid file:

```json
[
  { "question": "Two wrong options",  "answer": "A", "distractors": ["B", "C"] },
  { "question": "Three wrong options","answer": "A", "distractors": ["B", "C", "D"] },
  { "question": "Five wrong options", "answer": "A", "distractors": ["B", "C", "D", "E", "F"] }
]
```

Every question renders exactly the choices it supplied. Distractors are never generated,
fabricated, or borrowed from other questions, and a long list is never truncated nor a
short one padded — the JSON author is in full control of the answer choices.

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
- fewer than 2 distractors (`Question 7: Only 1 distractor supplied. At least 2 distractors are required.`)
- more than 5 distractors (`Question 12: 6 distractors supplied. The maximum supported number is 5.`)
- an empty `distractors` array
- the correct answer duplicated among the distractors
- two distractors that are the same choice

Duplicate detection ignores case and surrounding whitespace, so `"Paris"` and `"  paris "`
are treated as the same choice.

Nothing is repaired silently: an out-of-range question is rejected rather than trimmed or
topped up, and the message names the question number so it can be found in the file.

### Getting a starting file

On the upload page:

- **Download template JSON** → a file to fill in, leading with the recommended 3-distractor
  shape and then showing a 2- and a 5-distractor question
- **Download sample quiz** → a working 20-question general-knowledge quiz that mixes counts
- **Try the sample quiz** → loads that sample straight into the app

Once a file validates, the upload screen reports its answer-choice structure. A uniform
quiz reads:

```text
50 questions
3 distractors per question
4 total choices per question
```

and a mixed one reads:

```text
50 questions
2–5 distractors per question
3–6 total choices
```

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

A question with a different number of distractors — 2 here, so 3 total choices:

```json
{
  "question": "What is 2 + 2?",
  "answer": "4",
  "distractors": [
    "3",
    "5"
  ]
}
```

And one with 5 distractors, so 6 total choices:

```json
{
  "question": "Which number is prime?",
  "answer": "17",
  "distractors": ["12", "14", "15", "18", "21"]
}
```

Any reasonable number of questions is fine — 5 or 500. There is no fixed quiz length, and
no fixed choice count.

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
   same slot every time. This is independent of how many choices the question has: with 5
   distractors the correct answer turns up in all six positions across attempts, never
   pinned to first, last, or slot B.

Both use an unbiased **Fisher–Yates** shuffle ([`src/lib/shuffle.ts`](src/lib/shuffle.ts))
that copies rather than mutating. Deliberately *not* `items.sort(() => Math.random() - 0.5)`
— an inconsistent comparator skews heavily toward near-identity orderings, and the test
suite checks that all six permutations of a three-element array come up in roughly equal
proportion, which that approach fails.

**Scoring cannot be broken by either shuffle**, because answers are recorded against a
question id, never against a position:

- Each attempt question gets an id like `a1-q7` (attempt 1, display slot 7).
- Choice ids are assigned **after** the choices are shuffled (`a1-q7-c0` … `-c5`, as many
  as the question has), so an id can never be used to work out which choice is correct.
- The choice count never enters into correctness tracking: exactly one choice per question
  is flagged correct whatever the count, so 3-, 4-, 5-, and 6-choice questions all score
  identically.
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
- The browser enforces this as well: the Content-Security-Policy's `connect-src 'self'`
  (see [Security headers](#security-headers)) forbids the page from sending requests to any
  other origin, so even a future bug could not post a quiz somewhere else.

The statement above is shown in the UI on both the upload and results screens.

---

## 7. Build it

```bash
npm run build
```

This runs `tsc --noEmit` and then `vite build`, producing `dist/`:

```
dist/
├─ _headers            # security headers, parsed by Cloudflare (not served)
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

### Security headers

Production security headers live in [`public/_headers`](public/_headers). Vite copies it into
`dist/`, and Cloudflare Workers Static Assets parses it and applies it to responses; the
file itself is never served. There is no Worker script in this project, so every response
is a static asset and every response gets the headers, including the `index.html` served
for SPA deep links (verified with `wrangler dev`).

| Header | Value | Why |
| --- | --- | --- |
| `Content-Security-Policy` | see below | Restricts what the page may load, run, connect to, and who may frame it. |
| `X-Content-Type-Options` | `nosniff` | Stops browsers guessing a script or stylesheet out of a mis-typed response. |
| `X-Frame-Options` | `DENY` | Clickjacking protection for browsers that predate CSP `frame-ancestors`. |
| `Referrer-Policy` | `no-referrer` | The app links nowhere that needs a referrer; send none. |
| `Permissions-Policy` | every listed feature `=()` | Camera, microphone, geolocation, payment, USB, sensors, and similar are unused, so they are switched off for this page and anything it could embed. |
| `Cross-Origin-Opener-Policy` | `same-origin` | Puts the app in its own browsing-context group, so a cross-origin window cannot keep a handle on it. |
| `Cross-Origin-Resource-Policy` | `same-origin` | Other sites cannot pull the app's scripts, styles, or JSON into their pages. Direct links and downloads still work. |

The Content-Security-Policy:

```text
default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self'; connect-src 'self';
base-uri 'none'; form-action 'none'; frame-ancestors 'none'
```

It starts from `default-src 'none'` and allows back only what the built app uses: its own
JavaScript bundle, its own stylesheet, its own favicon, and same-origin `fetch()` (the sample
quiz). **There is no `'unsafe-inline'`, no `'unsafe-eval'`, and no wildcard.** None are
needed:

- The built `index.html` contains no inline script or style.
- React's `style={{...}}` props are applied through the CSSOM (`element.style`), which CSP
  does not restrict.
- Uploaded files are read with `File.text()`, and the template and sample downloads are
  plain same-origin links. CSP restricts neither.

`src/test/security-headers.test.ts` fails if the policy is loosened with any of those
keywords, or if an inline script or style attribute is added to `index.html` (the policy
would block it in production).

**Deliberately not set:**

- **`Strict-Transport-Security`.** On `*.workers.dev` it would add nothing: the whole `.dev`
  top-level domain is on the browser HSTS preload list, so browsers already refuse plain HTTP
  there (hstspreload.org lists `workers.dev` as preloaded via `dev`). On a custom domain,
  HSTS belongs in the Cloudflare zone (**SSL/TLS → Edge Certificates → HSTS**). Its
  `max-age`, `includeSubDomains`, and `preload` settings bind every subdomain of that domain,
  often for a year or more, and a header in this repo cannot know what else runs there.
- **`Cross-Origin-Embedder-Policy`.** Only needed for cross-origin isolation
  (`SharedArrayBuffer`, high-resolution timers), which the app does not use, and it would
  block any cross-origin resource added later.
- **`X-XSS-Protection`.** Obsolete: every current browser has removed the XSS auditor it
  controlled, and the auditor could itself be abused. CSP is the replacement.
- **`require-trusted-types-for 'script'`.** React DOM's bundle contains `innerHTML` sinks (for
  `dangerouslySetInnerHTML`). The app reaches none of them today, but enforcing Trusted Types
  without a policy would turn any future use into a hard runtime failure. Worth adopting
  deliberately, starting with a report-only trial, rather than by default.
- **`report-uri` / `report-to`.** There is nowhere to send reports. A static site would need a
  Worker or a third-party collector to receive them, which cuts against the app's
  nothing-leaves-the-browser design.
- **`upgrade-insecure-requests`.** Every subresource is same-origin, so there is nothing to
  upgrade.

**Checking them locally.** `npm run dev` (Vite) does **not** apply `_headers`; only the Workers
runtime does. To run under the production headers:

```bash
npm run build
npm run cf:dev          # then, in another terminal:
curl -I http://127.0.0.1:8787/
```

**If a Worker or API is added later:** `_headers` rules do not apply to responses generated by
Worker code. Set headers on those responses in the Worker itself. JSON API responses need
`X-Content-Type-Options: nosniff` and a suitable `Cross-Origin-Resource-Policy`, not the
document CSP. Leave CORS closed unless a cross-origin caller genuinely needs it.

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
| [`public/sample-quiz.json`](public/sample-quiz.json) | A working 20-question general-knowledge quiz. Mostly 3 distractors, with 2-, 4-, and 5-distractor questions mixed in so the range is visible. Served at `/sample-quiz.json`, linked from the upload page, and loaded by *Try the sample quiz*. |
| [`public/quiz-template.json`](public/quiz-template.json) | A template to fill in. Leads with the recommended 3-distractor shape, then shows a 2- and a 5-distractor question. Served at `/quiz-template.json`. |

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
│  ├─ _headers                   # Production security headers (Cloudflare)
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
   │  ├─ choices.ts              # Choice-count range, labels, quiz-shape summary
   │  ├─ attempt.ts              # Attempt building, grading, scoring
   │  ├─ validation.test.ts
   │  ├─ shuffle.test.ts
   │  ├─ choices.test.ts
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

168 tests across 6 files, covering:

- **Validation** — valid files, malformed JSON, a non-array root, an empty quiz, missing
  fields, wrong types, blank values, the answer duplicated among distractors, duplicate
  distractors, correct question numbering in messages, all problems collected in one pass,
  and that nothing is returned alongside issues (nothing silently discarded).
- **Distractor counts** — 2, 3, 4, and 5 distractors accepted; 1 and 6+ rejected with the
  message naming the minimum or maximum; an empty array rejected; a legacy three-distractor
  file accepted unchanged; a quiz mixing counts accepted; duplicates, answer clashes, and
  blanks caught at every count, including whitespace- and case-equivalent duplicates.
- **Choice rules and labels** (`src/lib/choices.test.ts`) — the supported range, the
  recommended default, distractors-to-total-choices arithmetic, labels A–F and beyond
  (Z then AA), and the uniform-vs-range quiz summary.
- **Shuffle** — no mutation of the input, every element preserved exactly once, correct
  behaviour at the rng boundaries, and a statistical check that the permutation distribution
  is uniform.
- **Attempts and scoring** — question-order randomization, choice-order randomization,
  `correctChoiceId` tracking through both shuffles, ids that do not leak the answer, perfect
  and zero scores, the 42/50 = 84% worked example, unanswered questions counted separately
  from incorrect ones, scoring independent of display position, stale selections from a
  previous attempt ignored, reshuffle correctness across repeated attempts, and percentage
  rounding.
- **Variable counts through the engine** — each supported count rendering the right number
  of choices, no truncation and no padding, choices only ever drawn from the question's own
  answer and distractors, a mixed-count quiz keeping each question's own shape, exactly one
  correct choice at every count, the correct answer reaching every slot at every count,
  scoring and review at 3/4/5/6 total choices, and a mixed-count reshuffle leaving the
  canonical source untouched.
- **User journeys** (`src/test/app.test.tsx`) — the whole flow against the real components:
  upload and validation feedback, taking the quiz, changing answers, navigation, the
  unanswered-submission warning and its escape routes, results, the review screen's
  correct/incorrect/unanswered distinction, filters, reshuffling, and quiz reset. Plus, for
  variable counts: 2/3/4/5 distractors rendering 3/4/5/6 labelled choices (A–F), a mixed
  quiz giving each question its own count, scoring and reviewing a mixed quiz, reshuffling
  one, the upload screen reporting a uniform count and a range, out-of-range questions
  rejected by question number, a two-distractor question now accepted where the old
  exactly-three rule refused it, and the on-page terminology.
- **Security headers** (`src/test/security-headers.test.ts`) — `public/_headers` is a single
  catch-all rule within Cloudflare's limits; every required header has its intended value;
  the CSP starts from `default-src 'none'`, allows only `'self'` for scripts, styles, images
  and connections, denies framing, `<base>`, and form submission, and contains no
  `'unsafe-inline'`, `'unsafe-eval'`, wildcard, or scheme source; Permissions-Policy denies
  every listed feature; HSTS is absent by decision; and `index.html` has no inline script,
  inline style, or inline event handler that the policy would block.
- **Shipped fixtures** — `public/sample-quiz.json`, `public/quiz-template.json`, and the
  example printed on the upload page all validate and produce a playable, gradeable attempt
  whose per-question choice count matches the distractors supplied; the sample and template
  both demonstrate more than one count while keeping 3 distractors as the majority shape.

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
