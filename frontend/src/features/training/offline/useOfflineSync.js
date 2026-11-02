import { useCallback, useEffect, useRef, useState } from "react";

import { apiRequest } from "../../../api/client";

import {
  enqueueSet,
  getQueueCount,
} from "./offlineQueue";

import {
  SessionExpiredError,
  SyncOrderError,
  replayQueue,
} from "./syncSets";

/**
 * Tracks offline state and replays the IndexedDB set queue.
 *
 * Status values:
 * - `idle`            nothing pending, online
 * - `offline`         device is offline (sets are still accepted)
 * - `syncing`         replay in progress
 * - `pending`         sets are queued and waiting for a network window
 * - `error`           replay failed for a non-auth reason; queue preserved
 * - `login-required`  replay hit an expired token; queue preserved
 */
export function useOfflineSync() {
  const [pending, setPending] = useState(0);
  const [online, setOnline] = useState(() =>
    typeof navigator === "undefined" ? true : navigator.onLine !== false,
  );
  const [status, setStatus] = useState(() =>
    typeof navigator !== "undefined" && navigator.onLine === false
      ? "offline"
      : "idle",
  );
  const [error, setError] = useState(null);

  const syncingRef = useRef(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const refreshCount = useCallback(async () => {
    try {
      const count = await getQueueCount();
      if (mountedRef.current) {
        setPending(count);
      }
      return count;
    } catch {
      return 0;
    }
  }, []);

  const sync = useCallback(async () => {
    if (syncingRef.current) {
      return null;
    }

    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      if (mountedRef.current) {
        setStatus("offline");
      }
      return null;
    }

    syncingRef.current = true;
    if (mountedRef.current) {
      setStatus("syncing");
      setError(null);
    }

    try {
      const result = await replayQueue({
        request: apiRequest,
        onProgress: ({ remaining }) => {
          if (mountedRef.current) {
            setPending(remaining);
          }
        },
      });

      if (mountedRef.current) {
        setPending(0);
        setStatus("idle");
      }

      return result;
    } catch (caught) {
      if (caught instanceof SessionExpiredError) {
        if (mountedRef.current) {
          setStatus("login-required");
          setError(caught.message);
        }
      } else if (caught instanceof SyncOrderError) {
        if (mountedRef.current) {
          setStatus("error");
          setError(caught.message);
        }
      } else if (mountedRef.current) {
        setStatus("error");
        setError(caught?.message || "Could not sync saved sets.");
      }

      await refreshCount();
      return null;
    } finally {
      syncingRef.current = false;
    }
  }, [refreshCount]);

  const enqueue = useCallback(
    async (record) => {
      const stored = await enqueueSet(record);
      const count = await refreshCount();

      if (mountedRef.current) {
        setPending(count);
        setStatus(
          typeof navigator !== "undefined" && navigator.onLine === false
            ? "offline"
            : "pending",
        );
      }

      if (typeof navigator === "undefined" || navigator.onLine !== false) {
        await sync();
      }

      return stored;
    },
    [refreshCount, sync],
  );

  useEffect(() => {
    // Async read: setPending runs after the IndexedDB read resolves.
    // eslint-disable-next-line react/set-state-in-effect
    refreshCount();

    const handleOnline = () => {
      setOnline(true);
      sync();
    };

    const handleOffline = () => {
      setOnline(false);
      setStatus("offline");
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    if (typeof navigator === "undefined" || navigator.onLine !== false) {
      sync();
    }

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [refreshCount, sync]);

  return {
    pending,
    online,
    status,
    error,
    sync,
    refreshCount,
    enqueue,
  };
}
