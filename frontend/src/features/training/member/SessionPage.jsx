import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";

import { apiRequest } from "../../../api/client";
import {
  PendingSyncIndicator,
  logSetWithOfflineFallback,
  newClientSetId,
  useOfflineSync,
} from "../offline";
import "./SessionPage.css";

export function SessionPage() {
  const { assignmentId, sessionId } = useParams();
  const effectiveSessionId = sessionId || assignmentId;

  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  const [selectedBlockId, setSelectedBlockId] = useState("");
  const [reps, setReps] = useState(10);
  const [weight, setWeight] = useState(0);

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

  const loadSession = useCallback(async () => {
    if (!effectiveSessionId) return;
    try {
      setLoadError(null);
      const data = await apiRequest(`/training/sessions/${effectiveSessionId}/`);
      setSession(data);
      if (data?.exercises?.length > 0 && !selectedBlockId) {
        setSelectedBlockId(data.exercises[0].block_id || data.exercises[0].exercise_id);
        const firstSet = data.exercises[0].sets?.[0];
        if (firstSet) {
          if (firstSet.reps != null) setReps(firstSet.reps);
          if (firstSet.weight_kg != null) setWeight(firstSet.weight_kg);
        }
      }
    } catch (caught) {
      setLoadError(caught?.message || "Could not load this session.");
    } finally {
      setLoading(false);
    }
  }, [effectiveSessionId, selectedBlockId]);

  useEffect(() => {
    loadSession();
  }, [loadSession]);

  const currentExercise = (session?.exercises || []).find(
    (ex) => (ex.block_id || ex.exercise_id) === selectedBlockId
  ) || session?.exercises?.[0];

  const handleExerciseChange = (blockId) => {
    setSelectedBlockId(blockId);
    const ex = (session?.exercises || []).find(
      (item) => (item.block_id || item.exercise_id) === blockId
    );
    if (ex) {
      // Find first incomplete set or last set
      const incomplete = (ex.sets || []).find((s) => !s.done);
      if (incomplete) {
        if (incomplete.reps != null) setReps(incomplete.reps);
        if (incomplete.weight_kg != null) setWeight(incomplete.weight_kg);
      } else if (ex.sets?.length) {
        const last = ex.sets[ex.sets.length - 1];
        if (last.reps != null) setReps(last.reps);
        if (last.weight_kg != null) setWeight(last.weight_kg);
      }
    }
  };

  const handleLogSet = async (event) => {
    event.preventDefault();
    setFormError(null);
    setNotice(null);

    if (!currentExercise) {
      setFormError("Please select an exercise first.");
      return;
    }

    setSaving(true);

    try {
      // Determine set_no
      const completedSets = (currentExercise.sets || []).filter((s) => s.done);
      const nextSetNo = completedSets.length + 1;

      const payload = {
        block_id: currentExercise.block_id || "",
        exercise_id: currentExercise.exercise_id || "",
        set_no: nextSetNo,
        reps: Number(reps) || 0,
        weight_kg: Number(weight) || 0,
        done: true,
      };

      const result = await logSetWithOfflineFallback({
        sessionId: effectiveSessionId,
        payload,
        clientSetId: newClientSetId(),
      });

      if (result.queued) {
        setNotice(
          online
            ? "Set saved locally and will sync automatically."
            : "You are offline. Set saved locally on this device."
        );
        if (online) {
          await sync();
        }
      } else {
        const updatedSession = result.data?.session || result.data;
        if (updatedSession) {
          setSession(updatedSession);
        } else {
          await loadSession();
        }
        setNotice(`Logged set ${nextSetNo} for ${currentExercise.exercise_name}!`);
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
        `/training/sessions/${effectiveSessionId}/complete/`,
        {
          method: "POST",
        }
      );
      setSession(data.session || data);
      setNotice(
        data?.already_completed
          ? "This session was already completed."
          : "Session completed! Great work."
      );
    } catch (caught) {
      setFormError(caught?.message || "Could not finish this session.");
    } finally {
      setSaving(false);
    }
  };

  if (!effectiveSessionId) {
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

  const exercises = session?.exercises || [];
  const isCompleted = session?.status === "completed";

  return (
    <section className="trn-session">
      <header className="trn-session-head">
        <div>
          <p className="trn-eyebrow">SESSION · {session?.session_date}</p>
          <h2>{session?.day_snapshot?.label || session?.day_key || "Today"}</h2>
        </div>
        <span
          className={`trn-session-status trn-session-status-${session?.status || "in_progress"}`}
        >
          {(session?.status || "in_progress").toUpperCase()}
        </span>
      </header>

      <PendingSyncIndicator
        pending={pending}
        online={online}
        status={status}
        error={syncError}
        onRetry={sync}
      />

      <div className="trn-session-overview">
        {exercises.length === 0 ? (
          <p className="trn-session-muted">No exercises in this session.</p>
        ) : (
          <ul className="trn-session-list">
            {exercises.map((ex) => {
              const completedCount = (ex.sets || []).filter((s) => s.done).length;
              const totalCount = ex.sets?.length || 0;
              const isSelected =
                (ex.block_id || ex.exercise_id) ===
                (currentExercise?.block_id || currentExercise?.exercise_id);

              return (
                <li
                  key={ex.block_id || ex.exercise_id}
                  style={{
                    cursor: isCompleted ? "default" : "pointer",
                    borderColor: isSelected ? "#6a3bd8" : undefined,
                  }}
                  onClick={() => !isCompleted && handleExerciseChange(ex.block_id || ex.exercise_id)}
                >
                  <div>
                    <strong>{ex.exercise_name}</strong>
                    {ex.notes && (
                      <p style={{ margin: "2px 0 0", fontSize: "0.78rem", color: "#6b657e" }}>
                        {ex.notes}
                      </p>
                    )}
                    <div style={{ marginTop: "4px", fontSize: "0.8rem", color: "#4a4460" }}>
                      {(ex.sets || []).map((s, idx) => (
                        <span
                          key={idx}
                          style={{
                            marginRight: "8px",
                            color: s.done ? "#1d6b32" : "#999",
                            fontWeight: s.done ? 600 : 400,
                          }}
                        >
                          S{s.set_no}: {s.reps}r @ {s.weight_kg ?? 0}kg {s.done ? "✓" : "○"}
                        </span>
                      ))}
                    </div>
                  </div>
                  <span>
                    {completedCount} / {totalCount} sets
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {!isCompleted ? (
        <form className="trn-session-form" onSubmit={handleLogSet}>
          <h3>Log Set: {currentExercise?.exercise_name || "Select Exercise"}</h3>

          {exercises.length > 1 && (
            <label>
              Select Movement
              <select
                value={selectedBlockId}
                onChange={(e) => handleExerciseChange(e.target.value)}
              >
                {exercises.map((ex) => (
                  <option
                    key={ex.block_id || ex.exercise_id}
                    value={ex.block_id || ex.exercise_id}
                  >
                    {ex.exercise_name} ({(ex.sets || []).filter((s) => s.done).length}/{ex.sets?.length || 0} sets)
                  </option>
                ))}
              </select>
            </label>
          )}

          <div className="trn-session-row">
            <label>
              Reps Completed
              <input
                type="number"
                min="0"
                value={reps}
                onChange={(e) => setReps(e.target.value)}
                required
              />
            </label>
            <label>
              Weight (kg)
              <input
                type="number"
                min="0"
                step="0.5"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
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
              {saving ? "Saving…" : "Log Set"}
            </button>
            <button
              type="button"
              className="trn-session-finish"
              onClick={handleFinish}
              disabled={saving}
            >
              Finish Session
            </button>
          </div>
        </form>
      ) : (
        <div className="trn-session-notice" role="status">
          <p>This session is completed. Your performance has been recorded.</p>
        </div>
      )}
    </section>
  );
}

export default SessionPage;
