/**
 * Replay queued sets to the server.
 *
 * Sets are sent strictly in the order they were captured. A set is removed
 * from the queue only after the server acknowledges it, so a crash mid-replay
 * re-sends the same `client_set_id` and the backend's idempotency rule keeps
 * the result exactly-once.
 */

import {
  getQueuedSets,
  markQueueItemFailed,
  removeQueuedSet,
} from "./offlineQueue.js";

export class SessionExpiredError extends Error {
  constructor(message) {
    super(
      message ||
        "Your session has expired. Sign in again to sync your saved sets.",
    );
    this.name = "SessionExpiredError";
  }
}

export class SyncOrderError extends Error {
  constructor(message) {
    super(message || "Could not sync saved sets.");
    this.name = "SyncOrderError";
  }
}

function isAuthFailure(error) {
  if (!error) {
    return false;
  }

  if (error.status === 401 || error.status === 403) {
    return true;
  }

  return /session has expired|sign in again|token_not_valid|not valid/i.test(
    error.message || "",
  );
}

export function sessionEndpoint(assignmentId, sessionId) {
  return `/training/sessions/session/${encodeURIComponent(
    assignmentId,
  )}/${encodeURIComponent(sessionId)}/`;
}

export function buildSetPayload(item) {
  return {
    sets: {
      exercise_name: item.payload?.exercise_name || "current",
      sets: item.payload?.sets ?? 0,
      reps: item.payload?.reps ?? 0,
      weight: item.payload?.weight ?? 0,
    },
    client_set_id: item.client_set_id,
  };
}

const defaultQueue = {
  getItems: getQueuedSets,
  removeItem: removeQueuedSet,
  markFailed: markQueueItemFailed,
};

/**
 * Send every queued set to the server.
 *
 * @param {object} [options]
 * @param {(progress: {synced: number, remaining: number, total: number}) => void} [options.onProgress]
 * @param {(endpoint: string, init: object) => Promise<object>} [options.request]
 * @param {{getItems: Function, removeItem: Function, markFailed: Function}} [options.queue]
 * @returns {Promise<{synced: number, remaining: number, total: number}>}
 */
export async function replayQueue(options = {}) {
  const {
    onProgress,
    request,
    queue = defaultQueue,
  } = options;

  if (typeof request !== "function") {
    throw new TypeError(
      "replayQueue requires a request function.",
    );
  }

  const items = await queue.getItems();
  const total = items.length;
  let synced = 0;

  for (const item of items) {
    try {
      await request(sessionEndpoint(item.assignment_id, item.session_id), {
        method: "PATCH",
        body: JSON.stringify(buildSetPayload(item)),
      });
    } catch (error) {
      if (isAuthFailure(error)) {
        throw new SessionExpiredError();
      }

      await queue.markFailed(
        item.client_set_id,
        error?.message || "Sync failed.",
      );

      // Stop at the first non-auth failure so the queue keeps its order.
      throw new SyncOrderError(
        error?.message ||
          "Could not sync saved sets. They are still stored on this device.",
      );
    }

    // Only remove after an acknowledged write. If this line is interrupted,
    // the next replay re-sends the same client_set_id, which the server
    // treats as a no-op.
    await queue.removeItem(item.client_set_id);
    synced += 1;
    onProgress?.({ synced, remaining: total - synced, total });
  }

  return { synced, remaining: 0, total };
}
