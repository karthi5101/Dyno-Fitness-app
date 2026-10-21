import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { useAuth } from "../../auth/AuthContext";

import {
  getMember,
  getMemberAttendance,
} from "../../api/client";

import "./DashboardPage.css";

const SESSION_LABELS = {
  morning_first: "Morning · First",
  morning_second: "Morning · Second",
  evening_first: "Evening · First",
  evening_second: "Evening · Second",
};

function getInitials(name = "") {
  return (
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) =>
        part.charAt(0).toUpperCase(),
      )
      .join("") || "M"
  );
}

function formatSession(session) {
  return (
    SESSION_LABELS[session] ||
    "Session not selected"
  );
}

function formatDate(value) {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function calculateAttendanceRate(records) {
  if (!records.length) {
    return 0;
  }

  const present = records.filter(
    (record) => record.status === "present",
  ).length;

  return Math.round(
    (present / records.length) * 100,
  );
}

function calculateStreak(records) {
  if (!records.length) {
    return 0;
  }

  const dates = new Set(
    records
      .filter(
        (record) => record.status === "present",
      )
      .map((record) => {
        const value = record.attendance_date;

        if (!value) {
          return null;
        }

        const date = new Date(value);

        if (Number.isNaN(date.getTime())) {
          return null;
        }

        return date.toISOString().slice(0, 10);
      })
      .filter(Boolean),
  );

  let streak = 0;
  const cursor = new Date();

  while (true) {
    const key = cursor
      .toISOString()
      .slice(0, 10);

    if (!dates.has(key)) {
      break;
    }

    streak += 1;

    cursor.setDate(
      cursor.getDate() - 1,
    );
  }

  return streak;
}

function DashboardPage() {
  const { memberId } = useAuth();

  const [member, setMember] = useState(null);
  const [attendance, setAttendance] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadDashboard() {
      if (!memberId) {
        setLoading(false);
        setError(
          "Your member account is not linked to a Dyno member.",
        );

        return;
      }

      try {
        setLoading(true);
        setError("");

        const [
          memberData,
          attendanceData,
        ] = await Promise.all([
          getMember(memberId),
          getMemberAttendance(memberId),
        ]);

        setMember(
          memberData?.value ||
            memberData,
        );

        setAttendance(
          Array.isArray(
            attendanceData?.value,
          )
            ? attendanceData.value
            : Array.isArray(
                attendanceData,
              )
              ? attendanceData
              : [],
        );
      } catch (err) {
        setError(
          err.message ||
            "Unable to load your dashboard.",
        );
      } finally {
        setLoading(false);
      }
    }

    loadDashboard();
  }, [memberId]);

  const attendanceRate = useMemo(
    () =>
      calculateAttendanceRate(
        attendance,
      ),
    [attendance],
  );

  const streak = useMemo(
    () =>
      calculateStreak(
        attendance,
      ),
    [attendance],
  );

  if (loading) {
    return (
      <section className="member-dashboard-page">
        <div className="member-dashboard-skeleton">
          <div />
          <div />
          <div />
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="member-dashboard-page">
        <div className="member-dashboard-state">
          <p className="member-eyebrow">
            DASHBOARD
          </p>

          <h1>
            Something went wrong.
          </h1>

          <p>{error}</p>
        </div>
      </section>
    );
  }

  const name =
    member?.name || "Member";

  return (
    <section className="member-dashboard-page">
      <header className="member-dashboard-header">
        <div>
          <p className="member-eyebrow">
            MEMBER / OVERVIEW
          </p>

          <h1>
            GOOD
            <br />
            EVENING,
            <br />
            <span>{name}</span>
          </h1>

          <p className="member-dashboard-intro">
            Your training, attendance and
            progress — all in one place.
          </p>
        </div>

        <div className="member-dashboard-header-actions">
          <Link
            className="member-profile-chip"
            to="/member/profile"
            aria-label={`Open profile for ${name}`}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "14px",
              minWidth: "250px",
              padding: "10px 12px 10px 10px",
              borderRadius: "22px",
              background: "#ffffff",
              border: "1px solid rgba(0, 0, 0, 0.10)",
              boxShadow:
                "0 8px 24px rgba(0, 0, 0, 0.06)",
              textDecoration: "none",
            }}
          >
            <span
              className="member-profile-avatar"
              style={{
                width: "58px",
                height: "58px",
                minWidth: "58px",
                borderRadius: "17px",
                background: "#111111",
                color: "#ffffff",
                display: "grid",
                placeItems: "center",
                fontSize: "21px",
                fontWeight: 700,
                letterSpacing: "-0.04em",
              }}
            >
              {getInitials(name)}
            </span>

            <span
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-start",
                justifyContent: "center",
                minWidth: 0,
                flex: 1,
                gap: "3px",
              }}
            >
              <strong
                style={{
                  color: "#111111",
                  fontSize: "14px",
                  lineHeight: 1.1,
                  fontWeight: 700,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  maxWidth: "145px",
                }}
              >
                {name}
              </strong>

              <small
                style={{
                  color: "#8a8a8a",
                  fontSize: "10px",
                  lineHeight: 1.1,
                  letterSpacing: "0.08em",
                }}
              >
                {memberId}
              </small>
            </span>

            <b
              aria-hidden="true"
              style={{
                width: "30px",
                height: "30px",
                minWidth: "30px",
                borderRadius: "50%",
                border: "1px solid #dedede",
                display: "grid",
                placeItems: "center",
                color: "#111111",
                fontSize: "14px",
                fontWeight: 500,
              }}
            >
              ↗
            </b>
          </Link>
        </div>
      </header>

      <article className="member-hero-card">
        <div className="member-hero-content">
          <p className="member-eyebrow member-eyebrow-light">
            TODAY&apos;S TRAINING
          </p>

          <h2>
            PUSH
            <br />
            YOUR
            <br />
            LIMIT.
          </h2>

          <Link
            className="member-outline-button member-outline-button-light"
            to="/member/workout"
          >
            VIEW WORKOUT <span>→</span>
          </Link>
        </div>
      </article>

      <section className="member-dashboard-stats">
        <article>
          <p>ATTENDANCE</p>

          <strong>
            {attendanceRate}%
          </strong>

          <span>
            overall consistency
          </span>
        </article>

        <article>
          <p>STREAK</p>

          <strong>{streak}</strong>

          <span>
            continuous days
          </span>
        </article>

        <article>
          <p>MEMBER SINCE</p>

          <strong>
            {member?.joining_date
              ? formatDate(
                  member.joining_date,
                ).split(" ")[2]
              : "—"}
          </strong>

          <span>
            {formatDate(
              member?.joining_date,
            )}
          </span>
        </article>
      </section>

      <section className="member-dashboard-grid">
        <article className="member-dashboard-card member-dashboard-session">
          <div className="member-card-heading">
            <div>
              <p className="member-eyebrow">
                YOUR SESSION
              </p>

              <h3>
                {formatSession(
                  member?.preferred_session,
                )}
              </h3>
            </div>

            <span>01</span>
          </div>

          <p>
            Your selected session stays as
            your default until you decide to
            change it.
          </p>

          <Link to="/member/profile">
            SESSION DETAILS <span>→</span>
          </Link>
        </article>

        <Link
          className="member-dashboard-card member-dashboard-attendance"
          to="/member/attendance"
          aria-label="View attendance history"
        >
          <div className="member-card-heading">
            <div>
              <p className="member-eyebrow">
                ATTENDANCE
              </p>

              <h3>
                SHOW UP.
              </h3>
            </div>

            <span>02</span>
          </div>

          <div className="member-attendance-preview">
            {Array.from({
              length: 14,
            }).map((_, index) => (
              <span
                key={index}
                className={
                  attendance[index]
                    ? "is-present"
                    : index >
                        attendance.length - 1
                      ? "is-upcoming"
                      : "is-missed"
                }
              />
            ))}
          </div>

          <div className="member-dashboard-attendance-action">
            VIEW HISTORY <span>→</span>
          </div>
        </Link>
      </section>

      <section className="member-dashboard-links">
        <Link to="/member/workout">
          <span>01</span>

          <strong>
            TODAY&apos;S WORKOUT
          </strong>

          <b>→</b>
        </Link>

        <Link to="/member/diet">
          <span>02</span>

          <strong>
            TODAY&apos;S DIET
          </strong>

          <b>→</b>
        </Link>

        <Link to="/member/progress">
          <span>03</span>

          <strong>
            YOUR PROGRESS
          </strong>

          <b>→</b>
        </Link>

        <Link to="/member/membership">
          <span>04</span>

          <strong>
            YOUR MEMBERSHIP
          </strong>

          <b>→</b>
        </Link>
      </section>
    </section>
  );
}

export default DashboardPage;