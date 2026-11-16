/**
 * Helpers for logging a single set with an offline fallback.
 */

import { apiRequest } from "../../../api/client";
import { enqueueSet } from "./offlineQueue";
import { buildSetPayload, sessionEndpoint } from "./syncSets";

/**
 * Generate a stable id for one set attempt.
 */
export function newClientSetId() {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }

  return `set-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 10)}`;
}

function isNetworkFailure(error) {
  return !error || typeof error.status !== "number";
}

/**
 * Try to write a set immediately; if the network is unavailable, persist it
 * to the IndexedDB queue instead so it can be replayed later.
 *
 * @returns {Promise<{queued: boolean, data?: object}>}
 */
export async function logSetWithOfflineFallback({
  assignmentId,
  sessionId,
  payload,
  clientSetId,
  request = apiRequest,
}) {
  const effectiveSessionId = sessionId || assignmentId;
  const record = {
    client_set_id: clientSetId || newClientSetId(),
    assignment_id: assignmentId,
    session_id: effectiveSessionId,
    payload,
  };

  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    await enqueueSet(record);
    return { queued: true, clientSetId: record.client_set_id };
  }

  try {
    const data = await request(
      sessionEndpoint(effectiveSessionId),
      {
        method: "PUT",
        body: JSON.stringify(buildSetPayload(record)),
      },
    );

    return { queued: false, data: data?.session || data, clientSetId: record.client_set_id };
  } catch (error) {
    if (!isNetworkFailure(error)) {
      throw error;
    }

    await enqueueSet(record);
    return { queued: true, clientSetId: record.client_set_id };
  }
}
