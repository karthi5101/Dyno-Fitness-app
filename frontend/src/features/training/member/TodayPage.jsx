import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { apiRequest } from "../../../api/client";
import {
  PendingSyncIndicator,
  useOfflineSync,
} from "../offline";
import "./TodayPage.css";

export function TodayPage() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
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
      setError(null);
      const res = await apiRequest("/training/me/today/");
      setData(res);
    } catch (caught) {
      setError(caught?.message || "Could not load today's session.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadToday();
  }, [loadToday]);

  const handleStartSession = async () => {
    try {
      setStarting(true);
      const newSession = await apiRequest("/training/sessions/start/", {
        method: "POST",
      });
      navigate(`/member/workout/session/${newSession.id}`);
    } catch (err) {
      setError(err?.message || "Could not start today's workout.");
    } finally {
      setStarting(false);
    }
  };

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

  const assignment = data?.assignment;
  const session = data?.session;
  const day = data?.day;
  const isRestDay = Boolean(data?.rest_day);
  const isNotStarted = Boolean(data?.not_started);

  if (!assignment) {
    return (
      <section className="trn-today">
        <article className="trn-today-card">
          <p className="trn-eyebrow">TRAINING</p>
          <h2>No Active Program</h2>
          <p className="trn-session-muted">
            You do not have an active program yet. Ask your coach to assign one.
          </p>
        </article>
      </section>
    );
  }

  if (isNotStarted) {
    return (
      <section className="trn-today">
        <article className="trn-today-card">
          <p className="trn-eyebrow">UPCOMING</p>
          <h2>{assignment.program_source_name || "Training Program"}</h2>
          <p className="trn-session-muted">
            Your program starts on {assignment.start_date || "an upcoming date"}.
          </p>
        </article>
      </section>
    );
  }

  if (isRestDay) {
    return (
      <section className="trn-today">
        <article className="trn-today-card">
          <p className="trn-eyebrow">TODAY</p>
          <h2>Rest Day</h2>
          <p className="trn-session-muted">
            Today is a scheduled recovery day. Rest, hydrate, and prepare for your next workout!
          </p>
        </article>
      </section>
    );
  }

  const exercises = session?.exercises || day?.blocks || [];

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
        <h2>{day?.label || session?.day_snapshot?.label || assignment.program_source_name || "Today's Session"}</h2>
        <p className="trn-session-muted">
          {session
            ? `${(session.status || "in_progress").toUpperCase()} · Date: ${session.session_date}`
            : "READY TO START"}
        </p>

        {exercises.length > 0 ? (
          <ul className="trn-session-list">
            {exercises.map((item, idx) => {
              const name = item.exercise_name || `Exercise ${idx + 1}`;
              const sets = item.sets || [];
              const completedCount = sets.filter((s) => s.done).length;

              return (
                <li key={item.block_id || item.exercise_id || idx}>
                  <strong>{name}</strong>
                  {session ? (
                    <span>
                      {completedCount} / {sets.length} sets completed
                    </span>
                  ) : (
                    <span>{sets.length} sets planned</span>
                  )}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="trn-session-muted">
            No movements assigned for today.
          </p>
        )}

        <div style={{ marginTop: "20px" }}>
          {session ? (
            <Link
              className="trn-today-open"
              to={`/member/workout/session/${session.id}`}
            >
              {session.status === "completed"
                ? "View session"
                : "Continue workout"}
            </Link>
          ) : (
            <button
              type="button"
              className="trn-today-open"
              onClick={handleStartSession}
              disabled={starting}
              style={{ border: "none", cursor: "pointer", width: "100%", textAlign: "center" }}
            >
              {starting ? "Starting workout…" : "Start workout"}
            </button>
          )}
        </div>
      </article>
    </section>
  );
}

export default TodayPage;
