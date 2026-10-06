import { IconCheck, IconLock, IconRefresh, IconShuffle } from "./Icons";

/**
 * The hero's right-hand composition: a stack of quiz cards with one worked example on top,
 * and three small feature chips beneath it.
 *
 * It is built from the same card, letter-badge, and chip primitives the real quiz uses, so
 * it reads as a preview of the interface rather than an illustration pasted beside it. The
 * card stack is purely decorative and hidden from assistive technology — the lede above it
 * already says what the app does. The chips are real text and stay in the accessibility
 * tree, labelled as a list of highlights.
 */

const DEMO_CHOICES = [
  { letter: "A", text: "Atlantic Ocean" },
  { letter: "B", text: "Pacific Ocean", selected: true },
  { letter: "C", text: "Indian Ocean" },
  { letter: "D", text: "Arctic Ocean" },
];

const HIGHLIGHTS = [
  { Icon: IconShuffle, text: "Randomized questions" },
  { Icon: IconLock, text: "Local-first & private" },
  { Icon: IconRefresh, text: "Review what you missed" },
];

export function HeroVisual() {
  return (
    <div className="hero-visual">
      <div className="hero-visual__stack" aria-hidden="true">
        <span className="hero-visual__shape hero-visual__shape--ring" />
        <span className="hero-visual__shape hero-visual__shape--disc" />
        <span className="hero-visual__shape hero-visual__shape--tile" />

        <div className="demo-card demo-card--back-2" />
        <div className="demo-card demo-card--back-1" />

        <div className="demo-card demo-card--front">
          <div className="demo-card__meta">
            <span className="demo-card__count">7 / 20</span>
            <span className="demo-card__progress">
              {Array.from({ length: 10 }, (_, index) => (
                <i key={index} className={index < 4 ? "is-done" : index === 4 ? "is-current" : ""} />
              ))}
            </span>
          </div>
          <p className="demo-card__question">Which ocean is the largest by surface area?</p>
          <ul className="demo-choices">
            {DEMO_CHOICES.map((choice) => (
              <li
                key={choice.letter}
                className={`demo-choice${choice.selected ? " demo-choice--selected" : ""}`}
              >
                <span className="demo-choice__letter">{choice.letter}</span>
                <span className="demo-choice__text">{choice.text}</span>
                {choice.selected && (
                  <span className="demo-choice__check">
                    <IconCheck size={16} />
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <ul className="chips" aria-label="Highlights">
        {HIGHLIGHTS.map(({ Icon, text }) => (
          <li key={text} className="chip">
            <Icon size={16} className="chip__icon" />
            {text}
          </li>
        ))}
      </ul>
    </div>
  );
}
