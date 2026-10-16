import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { getMemberAttendance } from "../../api/client";

import "./AttendancePage.css";

const MEMBER_ID =
  localStorage.getItem("dyno_member_id") || "MEM-0001";

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

function formatTime(value) {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function AttendancePage() {
  const [attendance, setAttendance] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadAttendance() {
      try {
        setLoading(true);
        setError("");

        const data = await getMemberAttendance(MEMBER_ID);

        setAttendance(Array.isArray(data) ? data : []);
      } catch (err) {
        setError(
          err.message || "Unable to load your attendance.",
        );
      } finally {
        setLoading(false);
      }
    }

    loadAttendance();
  }, []);

  const presentCount = useMemo(
    () =>
      attendance.filter(
        (record) => record.status === "present",
      ).length,
    [attendance],
  );

  const attendanceRate = attendance.length
    ? Math.round((presentCount / attendance.length) * 100)
    : 0;

  if (loading) {
    return (
      <section className="member-attendance-page">
        <div className="member-attendance-loading">
          <span />
          <span />
          <span />
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="member-attendance-page">
        <Link
          className="member-attendance-back"
          to="/member/dashboard"
        >
          ← BACK TO DASHBOARD
        </Link>

        <div className="member-attendance-error">
          <p>ATTENDANCE</p>
          <h1>SHOW UP.</h1>
          <span>{error}</span>
        </div>
      </section>
    );
  }

  return (
    <section className="member-attendance-page">
      <header className="member-attendance-header">
        <div>
          <Link
            className="member-attendance-back"
            to="/member/dashboard"
          >
            ← BACK TO DASHBOARD
          </Link>

          <p>MEMBER / ATTENDANCE</p>

          <h1>
            SHOW
            <br />
            UP.
          </h1>

          <span>
            Consistency is built one visit at a time.
          </span>
        </div>

        <Link
          className="member-attendance-scan"
          to="/member/attendance/scan"
        >
          <span>SCAN</span>
          <strong>CHECK IN</strong>
          <b>↗</b>
        </Link>
      </header>

      <section className="member-attendance-stats">
        <article>
          <span>VISITS</span>
          <strong>{presentCount}</strong>
          <small>recorded visits</small>
        </article>

        <article>
          <span>CONSISTENCY</span>
          <strong>{attendanceRate}%</strong>
          <small>attendance rate</small>
        </article>

        <article>
          <span>MEMBER ID</span>
          <strong>{MEMBER_ID}</strong>
          <small>your account</small>
        </article>
      </section>

      <section className="member-attendance-history">
        <div className="member-attendance-heading">
          <div>
            <p>YOUR RECORD</p>
            <h2>HISTORY</h2>
          </div>

          <span>{attendance.length}</span>
        </div>

        {attendance.length === 0 ? (
          <div className="member-attendance-empty">
            <strong>NO ATTENDANCE YET.</strong>
            <p>
              Your gym visits will appear here after you
              check in.
            </p>
          </div>
        ) : (
          attendance.map((record) => (
            <article
              className="member-attendance-row"
              key={
                record.id ||
                record.attendance_id ||
                record._id
              }
            >
              <div className="member-attendance-status">
                <span
                  className={
                    record.status === "present"
                      ? "is-present"
                      : "is-missed"
                  }
                />

                <strong>
                  {record.status === "present"
                    ? "PRESENT"
                    : "MISSED"}
                </strong>
              </div>

              <time>
                {formatDate(record.attendance_date)}
              </time>

              <span>
                {formatTime(record.check_in_time)}
              </span>

              <small>
                {record.notes || "Gym attendance"}
              </small>
            </article>
          ))
        )}
      </section>

      <section className="member-attendance-message">
        <p>KEEP GOING.</p>

        <h2>
          THE DAYS
          <br />
          ADD UP.
        </h2>
      </section>
    </section>
  );
}

export default AttendancePage;

