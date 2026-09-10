import { LogoMark } from "./Icons";
import { ThemeToggle } from "./ThemeToggle";

/**
 * Site header: wordmark, one contextual link, and the theme control.
 *
 * Deliberately small — the product is the page below it. The wordmark is not a "home" link:
 * the only home is the upload screen, and leaving a quiz in progress is an explicit action
 * on the quiz screen, not something to trigger by clicking a logo.
 */
export function SiteHeader({ showGuideLink }: { showGuideLink: boolean }) {
  return (
    <header className="site-header">
      <div className="container site-header__inner">
        <span className="wordmark">
          <LogoMark />
          <span className="wordmark__text">
            Quiz <span className="wordmark__soft">on Demand</span>
          </span>
        </span>

        <div className="site-header__actions">
          {showGuideLink && (
            <nav className="site-nav" aria-label="Page">
              <a className="site-nav__link" href="#format-guide">
                Format guide
              </a>
            </nav>
          )}
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
