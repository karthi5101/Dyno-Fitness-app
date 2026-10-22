import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { getAuthHeaders } from "../../api/client";

import "./SessionsPage.css";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  "http://127.0.0.1:8000/api";

async function request(endpoint) {
  const response = await fetch(
    `${API_BASE_URL}${endpoint}`,
    {
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeaders(),
      },
    },
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data?.detail ||
        data?.message ||
        "Unable to load sessions.",
    );
  }

  return data;
}

function formatSessionName(value) {
  if (!value) {
    return "Session";
  }

  return value
    .replaceAll("_", " ")
    .replaceAll("-", " ")
    .replace(/\b\w/g, (character) =>
      character.toUpperCase(),
    );
}

function SessionCard({ session, navigate }) {
  const expected = Number(
    session.expected_count ?? session.expected ?? 0,
  );

  const present = Number(
    session.present_count ?? session.present ?? 0,
  );

  const percentage =
    expected > 0
      ? Math.min(100, Math.round((present / expected) * 100))
      : 0;

  return (
    <article className="session-card">
      <div className="session-card-top">
        <span className="session-number">
          {session.session_key}
        </span>

        <span className="session-time">
          {session.start_time || "—"} —{" "}
          {session.end_time || "—"}
        </span>
      </div>

      <h2>
        {session.name ||
          formatSessionName(session.session_key)}
      </h2>

      <div className="session-count">
        <strong>{present}</strong>
        <span>/ {expected} PRESENT</span>
      </div>

      <div className="session-progress">
        <span style={{ width: `${percentage}%` }} />
      </div>

      <div className="session-footer">
        <span>{percentage}% attendance</span>

        <button
          type="button"
          onClick={() =>
            navigate("/staff/attendance")
          }
        >
          VIEW ATTENDANCE →
        </button>
      </div>
    </article>
  );
}

function SessionsPage() {
  const navigate = useNavigate();

  const [today, setToday] = useState(null);
  const [tomorrow, setTomorrow] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadSessions() {
      try {
        setLoading(true);
        setError("");

        const [todayData, tomorrowData] =
          await Promise.all([
            request("/sessions/today/"),
            request("/sessions/tomorrow/"),
          ]);

        setToday(todayData);
        setTomorrow(tomorrowData);
      } catch (err) {
        setError(
          err.message || "Unable to load sessions.",
        );
      } finally {
        setLoading(false);
      }
    }

    loadSessions();
  }, []);

  if (loading) {
    return (
      <section className="staff-page sessions-page">
        <div className="staff-state">
          <span className="staff-loader" />
          <p>Loading sessions...</p>
        </div>
      </section>
    );
  }

  const todaySessions =
    today?.sessions || today?.value || [];

  const tomorrowSessions =
    tomorrow?.sessions ||
    tomorrow?.value ||
    [];

  return (
    <section className="staff-page sessions-page">
      <header className="staff-page-header">
        <div>
          <p className="staff-eyebrow">STAFF — 4</p>
          <h1>THE FLOOR.</h1>
          <p>
            See the gym schedule, expected attendance,
            and session load before the day begins.
          </p>
        </div>
      </header>

      {error && (
        <div className="staff-message staff-message-error">
          {error}
        </div>
      )}

      <section className="sessions-day">
        <div className="sessions-day-header">
          <div>
            <p className="staff-eyebrow">TODAY</p>
            <h2>Today&apos;s sessions.</h2>
          </div>

          <span>
            {today?.date || "—"}
          </span>
        </div>

        <div className="sessions-grid">
          {todaySessions.length === 0 ? (
            <div className="staff-empty">
              <strong>No sessions scheduled.</strong>
            </div>
          ) : (
            todaySessions.map((session) => (
              <SessionCard
                key={session.session_key}
                session={session}
                navigate={navigate}
              />
            ))
          )}
        </div>
      </section>

      <section className="sessions-day sessions-day-secondary">
        <div className="sessions-day-header">
          <div>
            <p className="staff-eyebrow">NEXT</p>
            <h2>Tomorrow.</h2>
          </div>

          <span>
            {tomorrow?.date || "—"}
          </span>
        </div>

        <div className="sessions-grid">
          {tomorrowSessions.length === 0 ? (
            <div className="staff-empty">
              <strong>No sessions scheduled.</strong>
            </div>
          ) : (
            tomorrowSessions.map((session) => (
              <SessionCard
                key={session.session_key}
                session={session}
                navigate={navigate}
              />
            ))
          )}
        </div>
      </section>
    </section>
  );
}

export default SessionsPage;