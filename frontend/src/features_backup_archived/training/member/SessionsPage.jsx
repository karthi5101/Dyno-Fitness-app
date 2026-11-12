import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";

import { apiRequest } from "../../../api/client";
import "./SessionPage.css";

async function resolveAssignmentId(assignmentId) {
  if (assignmentId) {
    return assignmentId;
  }

  const data = await apiRequest("/training/assignments/");
  const active = (data?.assignments || []).find(
    (item) => item.status === "active",
  );
  return active?.id || null;
}

export function SessionsPage() {
  const params = useParams();
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadHistory = useCallback(async () => {
    try {
      const assignmentId = await resolveAssignmentId(
        params.assignmentId,
      );

      if (!assignmentId) {
        setSessions([]);
        return;
      }

      const data = await apiRequest(
        `/training/sessions/history/${encodeURIComponent(assignmentId)}/`,
      );
      setSessions(data?.sessions || []);
    } catch (caught) {
      setError(caught?.message || "Could not load session history.");
    } finally {
      setLoading(false);
    }
  }, [params.assignmentId]);

  useEffect(() => {
    // Async fetch: every setState in loadHistory runs after an await.
    // eslint-disable-next-line react/set-state-in-effect
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
          <h2>Completed sessions</h2>
        </div>
      </header>

      {sessions.length === 0 ? (
        <p className="trn-session-muted">
          No completed sessions yet. Finish a session to see it here.
        </p>
      ) : (
        <ul className="trn-session-list">
          {sessions.map((session) => {
            const exerciseCount = Object.keys(
              session.exercises || {},
            ).length;
            return (
              <li key={session.id}>
                <strong>{session.day_key || "Session"}</strong>
                <span>
                  {session.completed_at
                    ? new Date(
                        session.completed_at,
                      ).toLocaleDateString()
                    : "—"}
                </span>
                <span>
                  {exerciseCount} exercise
                  {exerciseCount === 1 ? "" : "s"}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

export default SessionsPage;
