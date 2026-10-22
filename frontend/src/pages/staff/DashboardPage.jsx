import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { useAuth } from "../../auth/AuthContext";
import { getDashboard } from "../../api/client";

import "./DashboardPage.css";

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

function DashboardPage() {
  const navigate = useNavigate();
  const { logout } = useAuth();

  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadDashboard() {
    try {
      setLoading(true);
      setError("");

      const data = await getDashboard();

      setDashboard(data);
    } catch (err) {
      setError(
        err.message ||
          "Unable to load the staff dashboard.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDashboard();
  }, []);

  function handleLogout() {
    logout();
    navigate("/login", { replace: true });
  }

  if (loading) {
    return (
      <section className="staff-page dashboard-page">
        <div className="staff-state">
          <span className="staff-loader" />
          <p>Loading today&apos;s gym...</p>
        </div>
      </section>
    );
  }

  const sessions =
    dashboard?.sessions?.sessions || [];

  const inactive =
    dashboard?.inactive_members || [];

  const payments =
    dashboard?.payments?.recent || [];

  const transformations =
    dashboard?.transformations?.recent || [];

  return (
    <section className="staff-page dashboard-page">
      <header className="dashboard-header">
        <div>
          <p className="staff-eyebrow">
            STAFF — OVERVIEW
          </p>

          <h1>
            TODAY&apos;S
            <br />
            GYM.
          </h1>

          <p>
            A live operational view of Dyno Fitness.
          </p>
        </div>

        <div className="dashboard-header-actions">
          <Link
            className="dashboard-members-button"
            to="/staff/members"
          >
            <span>MEMBERS</span>
            <strong>MANAGE MEMBERS</strong>
            <b>→</b>
          </Link>

          <button
            type="button"
            className="dashboard-logout-button"
            onClick={handleLogout}
          >
            LOG OUT
          </button>

          <div className="dashboard-date">
            <span>DATE</span>

            <strong>
              {dashboard?.date || "—"}
            </strong>
          </div>
        </div>
      </header>

      {error && (
        <div className="staff-message staff-message-error">
          {error}
        </div>
      )}

      {/* MEMBERS TODAY / ATTENDANCE */}
      <Link
        className="dashboard-hero dashboard-hero-link"
        to="/staff/attendance"
      >
        <div>
          <span>MEMBERS TODAY</span>

          <strong>
            {dashboard?.attendance
              ?.today_present ?? 0}
          </strong>
        </div>

        <div className="dashboard-hero-copy">
          <span>ATTENDANCE</span>

          <p>
            members have checked in today.
          </p>

          <b>OPEN ATTENDANCE →</b>
        </div>
      </Link>

      {/* PRIMARY MODULES */}
      <section className="dashboard-stat-grid">
        <Link
          className="dashboard-stat-card"
          to="/staff/members"
        >
          <span>ACTIVE MEMBERS</span>

          <strong>
            {dashboard?.members?.active ?? 0}
          </strong>

          <p>
            active members →
          </p>
        </Link>

        <Link
          className="dashboard-stat-card"
          to="/staff/sessions"
        >
          <span>SESSIONS</span>

          <strong>
            {dashboard?.sessions
              ?.total_present ?? 0}
          </strong>

          <p>
            session activity →
          </p>
        </Link>

        <Link
          className="dashboard-stat-card"
          to="/staff/membership"
        >
          <span>ACTIVE MEMBERSHIPS</span>

          <strong>
            {dashboard?.membership
              ?.active_count ?? 0}
          </strong>

          <p>
            membership records →
          </p>
        </Link>
      </section>

      {/* SESSIONS + INACTIVE MEMBERS */}
      <div className="dashboard-grid">
        <section className="dashboard-panel dashboard-panel-large">
          <div className="dashboard-panel-header">
            <div>
              <p className="staff-eyebrow">
                SCHEDULE
              </p>

              <h2>
                Today&apos;s sessions.
              </h2>
            </div>

            <Link to="/staff/sessions">
              VIEW ALL →
            </Link>
          </div>

          <div className="dashboard-sessions">
            {sessions.length === 0 ? (
              <div className="staff-empty">
                <strong>
                  No sessions scheduled.
                </strong>
              </div>
            ) : (
              sessions.map((session) => (
                <div
                  className="dashboard-session-row"
                  key={session.session_key}
                >
                  <div>
                    <strong>
                      {formatSessionName(
                        session.session_key,
                      )}
                    </strong>

                    <span>
                      {session.start_time} —{" "}
                      {session.end_time}
                    </span>
                  </div>

                  <strong>
                    {session.present_count ??
                      session.present ??
                      0}

                    <small>
                      /{" "}
                      {session.expected_count ??
                        session.expected ??
                        0}
                    </small>
                  </strong>
                </div>
              ))
            )}
          </div>
        </section>

        <Link
          className="dashboard-panel dashboard-panel-link"
          to="/staff/inactive-members"
        >
          <div className="dashboard-panel-header">
            <div>
              <p className="staff-eyebrow">
                ATTENTION
              </p>

              <h2>
                Inactive members.
              </h2>
            </div>

            <span>
              {inactive.length}
            </span>
          </div>

          {inactive.length === 0 ? (
            <div className="staff-empty">
              <strong>
                Nothing needs attention.
              </strong>
            </div>
          ) : (
            <div className="dashboard-members">
              {inactive
                .slice(0, 6)
                .map((member) => (
                  <div
                    key={member.member_id}
                    className="dashboard-member-row"
                  >
                    <span>
                      {member.name
                        ?.charAt(0)
                        ?.toUpperCase() || "M"}
                    </span>

                    <strong>
                      {member.name}
                    </strong>

                    <small>
                      {member.days_since_reference ??
                        0}
                      d
                    </small>
                  </div>
                ))}
            </div>
          )}

          <b className="dashboard-panel-footer">
            OPEN ALL INACTIVE MEMBERS →
          </b>
        </Link>
      </div>

      {/* PAYMENTS + TRANSFORMATIONS */}
      <div className="dashboard-grid">
        <Link
          className="dashboard-panel dashboard-panel-link"
          to="/staff/payments"
        >
          <div className="dashboard-panel-header">
            <div>
              <p className="staff-eyebrow">
                PAYMENTS
              </p>

              <h2>
                Recent payments.
              </h2>
            </div>

            <span>
              {payments.length}
            </span>
          </div>

          {payments.length === 0 ? (
            <div className="staff-empty">
              <strong>
                No recent payments.
              </strong>
            </div>
          ) : (
            payments
              .slice(0, 5)
              .map((payment) => (
                <div
                  className="dashboard-payment"
                  key={
                    payment._id ||
                    `${payment.member_id}-${payment.payment_date}`
                  }
                >
                  <span>
                    {payment.member_id}
                  </span>

                  <strong>
                    ₹
                    {Number(
                      payment.amount || 0,
                    ).toLocaleString("en-IN")}
                  </strong>
                </div>
              ))
          )}

          <b className="dashboard-panel-footer">
            OPEN PAYMENT HISTORY →
          </b>
        </Link>

        <div className="dashboard-panel dashboard-panel-link">
          <div className="dashboard-panel-header">
            <div>
              <p className="staff-eyebrow">
                PROGRESS
              </p>

              <h2>
                Recent transformations.
              </h2>
            </div>

            <span>
              {transformations.length}
            </span>
          </div>

          {transformations.length === 0 ? (
            <div className="staff-empty">
              <strong>
                No recent progress.
              </strong>
            </div>
          ) : (
            transformations
              .slice(0, 5)
              .map((record, index) => (
                <Link
                  className="dashboard-transformation"
                  key={
                    record._id ||
                    `${record.member_id}-${record.week_number}-${index}`
                  }
                  to={`/staff/progress/${encodeURIComponent(
                    record.member_id || "",
                  )}`}
                >
                  <strong>
                    {record.member_name ||
                      record.member_id ||
                      "Member"}
                  </strong>

                  <span>
                    WEEK{" "}
                    {record.week_number ??
                      record.week ??
                      "—"}
                  </span>

                  <b>
                    {record.weight_kg ??
                      record.weight
                      ? `${
                          record.weight_kg ??
                          record.weight
                        } KG`
                      : "—"}
                  </b>
                </Link>
              ))
          )}

          <Link
            className="dashboard-panel-footer"
            to="/staff/progress"
          >
            OPEN ALL TRANSFORMATIONS →
          </Link>
        </div>
      </div>
    </section>
  );
}

export default DashboardPage;
