import { IconFile, IconX } from "./Icons";
import type { SavedQuizSummary } from "../lib/savedQuizzes";

/**
 * The homepage's Saved quizzes list: one compact row per saved file, the filename being the
 * Open control. Rendered only when there is something to show; an empty browser gets no
 * empty-state panel. Every control names its quiz, so "Open" and "Remove" are never
 * ambiguous to a screen reader.
 */

const DATE = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" });

export function SavedQuizzes({
  items,
  error,
  busy,
  onOpen,
  onRemove,
}: {
  items: SavedQuizSummary[];
  /** A concise problem with the store, shown above the list. */
  error: string | null;
  busy: boolean;
  onOpen: (name: string) => void;
  onRemove: (name: string) => void;
}) {
  if (items.length === 0 && !error) return null;

  return (
    <section className="saved" aria-labelledby="saved-title">
      <div className="saved__head">
        <h2 id="saved-title" className="saved__title">
          Saved quizzes
        </h2>
        <p className="saved__note">
          Saved quizzes stay in this browser. They may be removed if site data is cleared.
        </p>
      </div>

      {error && (
        <p className="saved__error" role="status">
          {error}
        </p>
      )}

      {items.length > 0 && (
        <ul className="saved-list">
          {items.map((item) => (
            <li key={item.name} className="saved-item">
              <button
                type="button"
                className="saved-item__open"
                onClick={() => onOpen(item.name)}
                disabled={busy}
                aria-label={`Open ${item.name}`}
              >
                <span className="saved-item__icon" aria-hidden="true">
                  <IconFile size={16} />
                </span>
                <span className="saved-item__name">{item.name}</span>
                <span className="saved-item__date">Saved {DATE.format(item.savedAt)}</span>
              </button>
              <button
                type="button"
                className="btn btn--quiet btn--sm saved-item__remove"
                onClick={() => onRemove(item.name)}
                disabled={busy}
                aria-label={`Remove ${item.name}`}
              >
                <IconX size={14} /> Remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
