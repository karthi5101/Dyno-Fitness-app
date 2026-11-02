import { logout } from "../../../api/client";
import "./PendingSyncIndicator.css";

function signInAgain() {
  // Signing out must not touch the IndexedDB queue: the queued sets stay on
  // this device and replay after the member signs back in.
  logout();
  window.location.assign("/login");
}

/**
 * Small always-visible badge describing the offline set queue.
 *
 * @param {object} props
 * @param {number} props.pending
 * @param {boolean} props.online
 * @param {string} props.status
 * @param {string|null} [props.error]
 * @param {() => void} [props.onRetry]
 */
export function PendingSyncIndicator({
  pending,
  online,
  status,
  error,
  onRetry,
}) {
  if (status === "login-required") {
    return (
      <div
        className="trn-sync trn-sync-alert"
        role="alert"
        data-testid="pending-sync-indicator"
      >
        <span>
          {error ||
            "Your session expired. Sign in again to sync your saved sets."}
        </span>
        <span className="trn-sync-actions">
          <button type="button" onClick={signInAgain}>
            Sign in again
          </button>
        </span>
      </div>
    );
  }

  if (!pending && status === "idle" && online) {
    return null;
  }

  const label = (() => {
    if (!online) {
      return `Offline — ${pending} set${pending === 1 ? "" : "s"} saved on this device`;
    }
    if (status === "syncing") {
      return `Syncing ${pending} saved set${pending === 1 ? "" : "s"}…`;
    }
    if (status === "error") {
      return `Could not sync — ${pending} set${pending === 1 ? "" : "s"} still saved`;
    }
    return `${pending} set${pending === 1 ? "" : "s"} waiting to sync`;
  })();

  return (
    <div
      className={`trn-sync trn-sync-${status}`}
      role="status"
      aria-live="polite"
      data-testid="pending-sync-indicator"
    >
      <span>{label}</span>
      {(status === "error" || (!online && pending > 0)) && onRetry ? (
        <span className="trn-sync-actions">
          <button type="button" onClick={onRetry}>
            Retry now
          </button>
        </span>
      ) : null}
      {status === "error" && error ? (
        <span className="trn-sync-detail">{error}</span>
      ) : null}
    </div>
  );
}

export default PendingSyncIndicator;
