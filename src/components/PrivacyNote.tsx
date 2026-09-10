import { IconLock } from "./Icons";

/**
 * The privacy promise, stated beside the upload control rather than buried in the README.
 *
 * It is literally true of the architecture: there is no Worker script, no fetch of the
 * user's file anywhere in this app, and the CSP's connect-src 'self' forbids sending data to
 * any other origin. `File.text()` in `UploadScreen` is the only thing that touches the file.
 */
export function PrivacyNote() {
  return (
    <p className="trust-note">
      <IconLock size={16} className="trust-note__icon" />
      <span>
        Your quiz file is processed locally in your browser and is not uploaded or stored. No
        account needed.
      </span>
    </p>
  );
}
