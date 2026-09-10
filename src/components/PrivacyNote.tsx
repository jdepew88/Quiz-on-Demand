/**
 * The privacy promise, stated in the UI rather than buried in the README.
 *
 * It is literally true of the architecture: there is no Worker script, no fetch of the
 * user's file anywhere in this app, and no storage of any kind. `File.text()` in
 * `UploadScreen` is the only thing that ever touches the file.
 */
export function PrivacyNote() {
  return (
    <p className="notice notice--privacy">
      <span aria-hidden="true" style={{ flex: "none" }}>
        🔒
      </span>
      <span>
        <strong>
          Your quiz file is processed locally in your browser and is not uploaded or stored.
        </strong>{" "}
        There is no account, no database, and no server that ever sees your questions.
      </span>
    </p>
  );
}
