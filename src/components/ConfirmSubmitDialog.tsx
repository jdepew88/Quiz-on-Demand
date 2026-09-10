import { useEffect, useRef } from "react";
import { IconAlert } from "./Icons";

/**
 * Submission confirmation.
 *
 * Built by hand rather than with `<dialog>.showModal()` so the focus behaviour is
 * identical everywhere, including in the jsdom test environment.
 *
 * Accessibility contract: labelled by its own heading, described by its body, focus moves
 * in on open and returns to whatever opened it on close, Escape cancels, and Tab cycles
 * inside the dialog rather than wandering into the quiz behind it.
 */
export function ConfirmSubmitDialog({
  unansweredCount,
  totalCount,
  onCancel,
  onConfirm,
}: {
  unansweredCount: number;
  totalCount: number;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    // Land on the non-destructive choice: reviewing is the recoverable action.
    cancelRef.current?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onCancel();
        return;
      }

      if (event.key !== "Tab") return;

      const focusable = dialogRef.current?.querySelectorAll<HTMLElement>("button:not(:disabled)");
      if (!focusable || focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!first || !last) return;

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      previouslyFocused?.focus?.();
    };
  }, [onCancel]);

  const hasUnanswered = unansweredCount > 0;

  return (
    <div
      className="dialog-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onCancel();
      }}
    >
      <div
        className="dialog"
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby="confirm-body"
      >
        <h2 id="confirm-title" className="dialog__title">
          {hasUnanswered ? "Submit with unanswered questions?" : "Submit your quiz?"}
        </h2>

        <div
          id="confirm-body"
          className={hasUnanswered ? "dialog__body dialog__body--warning" : "dialog__body"}
        >
          {hasUnanswered ? (
            <>
              <IconAlert size={18} className="dialog__icon" />
              <p>
                <strong>
                  {unansweredCount} of {totalCount} question{totalCount === 1 ? "" : "s"}{" "}
                  {unansweredCount === 1 ? "is" : "are"} still unanswered.
                </strong>{" "}
                Unanswered questions are scored as incorrect.
              </p>
            </>
          ) : (
            <p>
              All {totalCount} question{totalCount === 1 ? "" : "s"} answered. You cannot change
              your answers after submitting.
            </p>
          )}
        </div>

        <div className="dialog__actions">
          <button type="button" className="btn btn--quiet" ref={cancelRef} onClick={onCancel}>
            {hasUnanswered ? "Return to quiz" : "Keep checking"}
          </button>
          <button type="button" className="btn btn--primary" onClick={onConfirm}>
            {hasUnanswered ? "Submit anyway" : "Submit quiz"}
          </button>
        </div>
      </div>
    </div>
  );
}
