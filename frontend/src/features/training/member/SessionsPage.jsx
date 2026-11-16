import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { apiRequest } from "../../../api/client";
import "./SessionPage.css";

export function SessionsPage() {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadHistory = useCallback(async () => {
    try {
      setError(null);
      const data = await apiRequest("/training/me/history/");
      setSessions(Array.isArray(data) ? data : data?.sessions || []);
    } catch (caught) {
      setError(caught?.message || "Could not load session history.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  if (loading) {
    return <p className="trn-session-muted">Loading history…</p>;
  }

  if (error) {
    return (
      <div className="trn-session-error" role="alert">
        <p>{error}</p>
        <button
          type="button"
          onClick={() => {
            setLoading(true);
            setError(null);
            loadHistory();
          }}
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <section className="trn-session">
      <header className="trn-session-head">
        <div>
          <p className="trn-eyebrow">HISTORY</p>
          <h2>Workout History</h2>
        </div>
      </header>

      {sessions.length === 0 ? (
        <p className="trn-session-muted">
          No training sessions recorded yet. Complete a workout to see it here!
        </p>
      ) : (
        <ul className="trn-session-list">
          {sessions.map((session) => {
            const dateStr = session.session_date || (session.completed_at ? new Date(session.completed_at).toLocaleDateString() : "—");
            const label = session.day_label || session.day_key || "Session";
            const exercisesText = `${session.exercise_count ?? 0} exercise${session.exercise_count === 1 ? "" : "s"}`;
            const setsText = `${session.completed_sets ?? 0}/${session.set_count ?? 0} sets`;

            return (
              <li key={session.id}>
                <Link
                  to={`/member/workout/session/${session.id}`}
                  style={{ textDecoration: "none", color: "inherit", display: "contents" }}
                >
                  <div>
                    <strong>{label}</strong>
                    <div style={{ fontSize: "0.8rem", color: "#6b657e" }}>{dateStr}</div>
                  </div>
                  <span>{exercisesText} · {setsText}</span>
                  <span
                    className={`trn-session-status trn-session-status-${session.status || "completed"}`}
                  >
                    {(session.status || "completed").toUpperCase()}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

export default SessionsPage;
