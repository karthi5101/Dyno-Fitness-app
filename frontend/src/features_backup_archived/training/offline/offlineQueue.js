/**
 * Native IndexedDB queue for offline set logging.
 *
 * No third-party dependency is used. Each queued set is keyed by its
 * `client_set_id`, which makes enqueueing idempotent: replaying the same
 * set twice can never create two records in the queue.
 */

const DB_NAME = "dyno-training-offline";
const DB_VERSION = 1;
const STORE = "setQueue";
const CREATED_INDEX = "createdAt";

let dbPromise = null;

function hasIndexedDB() {
  return typeof indexedDB !== "undefined";
}

function openDatabase() {
  if (!hasIndexedDB()) {
    return Promise.reject(
      new Error("Offline storage is not available in this browser."),
    );
  }

  if (dbPromise) {
    return dbPromise;
  }

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, {
          keyPath: "client_set_id",
        });
        store.createIndex(CREATED_INDEX, "createdAt");
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error || new Error("Could not open offline storage."));
    request.onblocked = () =>
      reject(new Error("Offline storage is blocked by another tab."));
  });

  return dbPromise;
}

function runTransaction(mode, work) {
  return openDatabase().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, mode);
        const store = tx.objectStore(STORE);
        let result;

        try {
          result = work(store);
        } catch (error) {
          reject(error);
          return;
        }

        tx.oncomplete = () => resolve(result);
        tx.onerror = () =>
          reject(tx.error || new Error("Offline storage transaction failed."));
        tx.onabort = () =>
          reject(tx.error || new Error("Offline storage transaction aborted."));
      }),
  );
}

function requestToPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Add a set to the queue. Re-adding the same `client_set_id` overwrites the
 * previous record instead of creating a duplicate.
 *
 * @param {object} record
 * @param {string} record.client_set_id
 * @param {string} record.assignment_id
 * @param {string} record.session_id
 * @param {object} record.payload
 */
export async function enqueueSet(record) {
  if (!record || !record.client_set_id) {
    throw new Error("A client_set_id is required to queue a set.");
  }

  const now = Date.now();
  const { createdAt, ...rest } = record;
  const stored = {
    ...rest,
    attempts: record.attempts ?? 0,
    last_error: record.last_error ?? null,
    // Never allow a caller to silently reorder the queue.
    createdAt: createdAt || now,
    updatedAt: now,
  };

  await runTransaction("readwrite", (store) => {
    store.put(stored);
  });

  return stored;
}

/**
 * Return queued sets in the order they were first captured.
 */
export async function getQueuedSets() {
  if (!hasIndexedDB()) {
    return [];
  }

  const items = await runTransaction("readonly", (store) =>
    requestToPromise(store.getAll()),
  );

  return (items || []).sort((a, b) => {
    if (a.createdAt === b.createdAt) {
      return String(a.client_set_id).localeCompare(
        String(b.client_set_id),
      );
    }
    return a.createdAt - b.createdAt;
  });
}

/**
 * Number of sets waiting to sync.
 */
export async function getQueueCount() {
  if (!hasIndexedDB()) {
    return 0;
  }

  const count = await runTransaction("readonly", (store) =>
    requestToPromise(store.count()),
  );

  return count || 0;
}

/**
 * Remove a set once the server has accepted it.
 */
export async function removeQueuedSet(clientSetId) {
  if (!clientSetId) {
    return;
  }

  await runTransaction("readwrite", (store) => {
    store.delete(clientSetId);
  });
}

/**
 * Record a failed attempt so the UI can show why a set is stuck.
 */
export async function markQueueItemFailed(clientSetId, message) {
  if (!clientSetId) {
    return;
  }

  await runTransaction("readwrite", (store) => {
    const request = store.get(clientSetId);
    request.onsuccess = () => {
      const item = request.result;
      if (!item) {
        return;
      }
      store.put({
        ...item,
        attempts: (item.attempts || 0) + 1,
        last_error: message || "Sync failed.",
        updatedAt: Date.now(),
      });
    };
  });
}

/**
 * Remove every queued set. Used by tests and by an explicit user reset.
 */
export async function clearQueue() {
  if (!hasIndexedDB()) {
    return;
  }

  await runTransaction("readwrite", (store) => {
    store.clear();
  });
}
