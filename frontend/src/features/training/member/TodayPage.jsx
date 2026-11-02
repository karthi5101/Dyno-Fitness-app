import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { apiRequest } from "../../../api/client";
import {
  PendingSyncIndicator,
  useOfflineSync,
} from "../offline";
import "./TodayPage.css";

export function TodayPage() {
  const [assignment, setAssignment] = useState(null);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const {
    pending,
    online,
    status,
    error: syncError,
    sync,
  } = useOfflineSync();

  const loadToday = useCallback(async () => {
    try {
      const assignmentData = await apiRequest(
        "/training/assignments/",
      );
      const active = (assignmentData?.assignments || []).find(
        (item) => item.status === "active",
      );

      if (!active) {
        setAssignment(null);
        setSession(null);
        return;
      }

      setAssignment(active);

      const today = await apiRequest(
        `/training/sessions/today/${encodeURIComponent(active.id)}/`,
      );
      setSession(today);
    } catch (caught) {
      setError(caught?.message || "Could not load today's session.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Async fetch: every setState in loadToday runs after an await.
    // eslint-disable-next-line react/set-state-in-effect
    loadToday();
  }, [loadToday]);

  if (loading) {
    return <p className="trn-session-muted">Loading today…</p>;
  }

  if (error) {
    return (
      <div className="trn-today-error" role="alert">
        <p>{error}</p>
        <button
          type="button"
          onClick={() => {
            setLoading(true);
            setError(null);
            loadToday();
          }}
        >
          Try again
        </button>
      </div>
    );
  }

  if (!assignment) {
    return (
      <p className="trn-session-muted">
        You do not have an active program yet. Ask your coach to assign one.
      </p>
    );
  }

  const exercises = session?.exercises || {};
  const exerciseNames = Object.keys(exercises);

  return (
    <section className="trn-today">
      <PendingSyncIndicator
        pending={pending}
        online={online}
        status={status}
        error={syncError}
        onRetry={sync}
      />

      <article className="trn-today-card">
        <p className="trn-eyebrow">TODAY</p>
        <h2>{assignment.program_source_name || "Your program"}</h2>
        <p className="trn-session-muted">
          {session?.day_key || "Today's session"} ·{" "}
          {(session?.status || "active").toUpperCase()}
        </p>

        {exerciseNames.length > 0 ? (
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
        ) : (
          <p className="trn-session-muted">
            Nothing logged yet. Open the session to add sets.
          </p>
        )}

        {session?.id ? (
          <Link
            className="trn-today-open"
            to={`/member/workout/session/${assignment.id}/${session.id}`}
          >
            {session.status === "completed"
              ? "View session"
              : "Open session"}
          </Link>
        ) : null}
      </article>
    </section>
  );
}

export default TodayPage;
