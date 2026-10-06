import { IconCheck, IconLock, IconRefresh, IconShuffle } from "./Icons";

/**
 * The hero's right-hand composition: a tilted stack of quiz cards with one worked example on
 * top, three small feature callouts tucked against its right edge, and a few abstract
 * shapes behind.
 *
 * It is built from the same card, letter-badge, and callout primitives the real quiz uses,
 * so it reads as a preview of the interface rather than an illustration pasted beside it.
 * The card stack is purely decorative and hidden from assistive technology — the lede above
 * it already says what the app does. The callouts are real text and stay in the
 * accessibility tree, labelled as a list of highlights.
 */

const DEMO_CHOICES = [
  { letter: "A", text: "Atlantic Ocean" },
  { letter: "B", text: "Pacific Ocean", selected: true },
  { letter: "C", text: "Indian Ocean" },
  { letter: "D", text: "Arctic Ocean" },
];

const HIGHLIGHTS = [
  { Icon: IconShuffle, title: "Randomized", text: "questions" },
  { Icon: IconLock, title: "Local-first", text: "& private" },
  { Icon: IconRefresh, title: "Review", text: "what you missed" },
];

export function HeroVisual() {
  return (
    <div className="hero-visual">
      <div className="hero-visual__scene">
        <div className="hero-visual__stack" aria-hidden="true">
          <span className="hero-visual__shape hero-visual__shape--arc" />
          <span className="hero-visual__shape hero-visual__shape--disc" />
          <span className="hero-visual__shape hero-visual__shape--dots" />
          <span className="hero-visual__shape hero-visual__shape--blob" />

          <div className="demo-card demo-card--back-2" />
          <div className="demo-card demo-card--back-1" />

          <div className="demo-card demo-card--front">
            <div className="demo-card__meta">
              <span className="demo-card__tag">Sample question</span>
              <span className="demo-card__count">1 / 20</span>
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

        <ul className="callouts" aria-label="Highlights">
          {HIGHLIGHTS.map(({ Icon, title, text }) => (
            <li key={title} className="callout">
              <span className="callout__icon" aria-hidden="true">
                <Icon size={18} />
              </span>
              <span className="callout__body">
                <span className="callout__title">{title}</span>
                <span className="callout__text">{text}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
