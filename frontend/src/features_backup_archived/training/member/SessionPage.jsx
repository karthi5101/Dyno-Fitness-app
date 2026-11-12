import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";

import { apiRequest } from "../../../api/client";
import {
  PendingSyncIndicator,
  logSetWithOfflineFallback,
  newClientSetId,
  sessionEndpoint,
  useOfflineSync,
} from "../offline";
import "./SessionPage.css";

const EMPTY_SET = {
  exercise_name: "",
  sets: 3,
  reps: 10,
  weight: 0,
};

export function SessionPage() {
  const { assignmentId, sessionId } = useParams();

  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [form, setForm] = useState(EMPTY_SET);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState(null);
  const [formError, setFormError] = useState(null);

  const {
    pending,
    online,
    status,
    error: syncError,
    sync,
  } = useOfflineSync();

  const hasParams = Boolean(assignmentId && sessionId);

  const loadSession = useCallback(async () => {
    try {
      const data = await apiRequest(
        sessionEndpoint(assignmentId, sessionId),
      );
      setSession(data);
    } catch (caught) {
      setLoadError(caught?.message || "Could not load this session.");
    } finally {
      setLoading(false);
    }
  }, [assignmentId, sessionId]);

  useEffect(() => {
    if (hasParams) {
      // Async fetch: every setState in loadSession runs after an await.
      // eslint-disable-next-line react/set-state-in-effect
      loadSession();
    }
  }, [hasParams, loadSession]);

  const updateField = (field) => (event) => {
    const value = event.target.value;
    setForm((current) => ({
      ...current,
      [field]:
        field === "exercise_name" ? value : Number(value),
    }));
  };

  const handleLogSet = async (event) => {
    event.preventDefault();
    setFormError(null);
    setNotice(null);

    if (!form.exercise_name.trim()) {
      setFormError("Enter an exercise name before logging the set.");
      return;
    }

    setSaving(true);

    try {
      const result = await logSetWithOfflineFallback({
        assignmentId,
        sessionId,
        payload: { ...form, exercise_name: form.exercise_name.trim() },
        // One stable id per attempt. Re-clicking after a failure reuses it
        // only if the caller retries the same attempt; a new set gets a new
        // id so it is recorded separately.
        clientSetId: newClientSetId(),
      });

      if (result.queued) {
        setNotice(
          online
            ? "Set saved on this device and will sync automatically."
            : "You are offline. Set saved on this device.",
        );
        setForm(EMPTY_SET);

        // Try a replay now. If the token expired, this flips the indicator to
        // the login-required prompt without dropping the queued set.
        if (online) {
          await sync();
        }
      } else {
        setSession(result.data);
        setNotice("Set logged.");
        setForm(EMPTY_SET);
      }
    } catch (caught) {
      setFormError(caught?.message || "Could not log this set.");
    } finally {
      setSaving(false);
    }
  };

  const handleFinish = async () => {
    setFormError(null);
    setNotice(null);
    setSaving(true);

    try {
      const data = await apiRequest(
        sessionEndpoint(assignmentId, sessionId),
        {
          method: "PATCH",
          body: JSON.stringify({ action: "finish" }),
        },
      );
      setSession(data);
      setNotice(
        data?.note
          ? "This session was already completed."
          : "Session completed.",
      );
    } catch (caught) {
      setFormError(caught?.message || "Could not finish this session.");
    } finally {
      setSaving(false);
    }
  };

  if (!hasParams) {
    return (
      <div className="trn-session-error" role="alert">
        <p>This session link is incomplete.</p>
      </div>
    );
  }

  if (loading) {
    return <p className="trn-session-muted">Loading session…</p>;
  }

  if (loadError) {
    return (
      <div className="trn-session-error" role="alert">
        <p>{loadError}</p>
        <button
          type="button"
          onClick={() => {
            setLoading(true);
            setLoadError(null);
            loadSession();
          }}
        >
          Try again
        </button>
      </div>
    );
  }

  const exercises = session?.exercises || {};
  const exerciseNames = Object.keys(exercises);
  const isActive = (session?.status || "active") === "active";

  return (
    <section className="trn-session">
      <header className="trn-session-head">
        <div>
          <p className="trn-eyebrow">SESSION</p>
          <h2>{session?.day_key || "Today"}</h2>
        </div>
        <span
          className={`trn-session-status trn-session-status-${session?.status || "active"}`}
        >
          {(session?.status || "active").toUpperCase()}
        </span>
      </header>

      <PendingSyncIndicator
        pending={pending}
        online={online}
        status={status}
        error={syncError}
        onRetry={sync}
      />

      {exerciseNames.length === 0 ? (
        <p className="trn-session-muted">
          No sets logged yet. Add your first set below.
        </p>
      ) : (
        <ul className="trn-session-list">
          {exerciseNames.map((name) => {
            const entry = exercises[name] || {};
            return (
              <li key={name}>
                <strong>{name}</strong>
                <span>
                  {entry.sets} × {entry.reps}
                </span>
                <span>{entry.weight ?? 0} kg</span>
              </li>
            );
          })}
        </ul>
      )}

      {isActive ? (
        <form className="trn-session-form" onSubmit={handleLogSet}>
          <h3>Log a set</h3>

          <label>
            Exercise
            <input
              type="text"
              value={form.exercise_name}
              onChange={updateField("exercise_name")}
              placeholder="e.g. Bench Press"
              autoComplete="off"
            />
          </label>

          <div className="trn-session-row">
            <label>
              Sets
              <input
                type="number"
                min="1"
                value={form.sets}
                onChange={updateField("sets")}
              />
            </label>
            <label>
              Reps
              <input
                type="number"
                min="1"
                value={form.reps}
                onChange={updateField("reps")}
              />
            </label>
            <label>
              Weight (kg)
              <input
                type="number"
                min="0"
                step="0.5"
                value={form.weight}
                onChange={updateField("weight")}
              />
            </label>
          </div>

          {formError ? (
            <p className="trn-session-error" role="alert">
              {formError}
            </p>
          ) : null}

          {notice ? (
            <p className="trn-session-notice" role="status">
              {notice}
            </p>
          ) : null}

          <div className="trn-session-actions">
            <button type="submit" disabled={saving}>
              {saving ? "Saving…" : "Log set"}
            </button>
            <button
              type="button"
              className="trn-session-finish"
              onClick={handleFinish}
              disabled={saving}
            >
              Finish session
            </button>
          </div>
        </form>
      ) : (
        <p className="trn-session-muted">
          This session is completed. Its history is preserved.
        </p>
      )}
    </section>
  );
}

export default SessionPage;
