import { useEffect, useState } from "react";

import { getDashboard } from "../api/client";
import "./DashboardPage.css";

function formatSessionName(sessionName) {
  if (!sessionName) {
    return "Unknown session";
  }

  return sessionName
    .replaceAll("_", " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function formatDate(dateString) {
  if (!dateString) {
    return "—";
  }

  const date = new Date(`${dateString}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return dateString;
  }

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function DashboardPage() {
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadDashboard() {
      try {
        setLoading(true);
        setError("");

        const data = await getDashboard();

        setDashboard(data);
      } catch (err) {
        setError(err.message || "Unable to load dashboard.");
      } finally {
        setLoading(false);
      }
    }

    loadDashboard();
  }, []);

  if (loading) {
    return (
      <section className="dashboard-page">
        <div className="dashboard-state">
          <span className="dashboard-loader" />
          <p>Loading your Dyno overview...</p>
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="dashboard-page">
        <div className="dashboard-state dashboard-state-error">
          <p>{error}</p>
        </div>
      </section>
    );
  }

  const sessions = dashboard?.sessions?.sessions || [];
  const inactiveMembers = dashboard?.inactive_members || [];
  const recentPayments = dashboard?.payments?.recent || [];
  const recentTransformations =
    dashboard?.transformations?.recent || [];

  const activeMembers = dashboard?.members?.active ?? 0;
  const totalMembers = dashboard?.members?.total ?? 0;
  const presentToday =
    dashboard?.attendance?.today_present ?? 0;
  const activeMemberships =
    dashboard?.membership?.active_count ?? 0;

  return (
    <section className="dashboard-page">
      <header className="dashboard-hero">
        <div className="dashboard-hero-copy">
          <p className="dashboard-eyebrow">OVERVIEW</p>

          <h1 className="dashboard-hero-title">
            GOOD TO SEE
            <br />
            <span>YOU.</span>
          </h1>

          <p className="dashboard-hero-description">
            Here&apos;s what&apos;s happening at Dyno today.
          </p>
        </div>

        <div className="dashboard-hero-date">
          <span>DATE</span>
          <strong>
            {formatDate(dashboard?.date)}
          </strong>
        </div>
      </header>

      <section className="dashboard-feature">
        <div className="dashboard-feature-content">
          <p className="dashboard-feature-eyebrow">
            TODAY AT DYNO
          </p>

          <h2 className="dashboard-feature-title">
            TRAIN.
            <br />
            MOVE.
            <br />
            BECOME.
          </h2>

          <p className="dashboard-feature-copy">
            Your gym overview, attendance and member activity
            in one place.
          </p>
        </div>

        <div className="dashboard-feature-stats">
          <div className="dashboard-feature-stat">
            <strong>
              {String(activeMembers).padStart(2, "0")}
            </strong>

            <span>ACTIVE MEMBERS</span>
          </div>

          <div className="dashboard-feature-stat">
            <strong>
              {String(presentToday).padStart(2, "0")}
            </strong>

            <span>PRESENT TODAY</span>
          </div>
        </div>

        <div className="dashboard-feature-mark">
          D
        </div>
      </section>

      <section className="dashboard-number-strip">
        <article className="dashboard-number">
          <span className="dashboard-number-label">
            MEMBERS
          </span>

          <strong>
            {String(activeMembers).padStart(2, "0")}
          </strong>

          <p>
            active of {totalMembers} registered
          </p>
        </article>

        <article className="dashboard-number dashboard-number-accent">
          <span className="dashboard-number-label">
            ATTENDANCE
          </span>

          <strong>
            {String(presentToday).padStart(2, "0")}
          </strong>

          <p>members present today</p>
        </article>

        <article className="dashboard-number">
          <span className="dashboard-number-label">
            MEMBERSHIP
          </span>

          <strong>
            {String(activeMemberships).padStart(2, "0")}
          </strong>

          <p>active memberships</p>
        </article>

        <article className="dashboard-number">
          <span className="dashboard-number-label">
            EXPECTED
          </span>

          <strong>
            {String(
              dashboard?.sessions?.total_expected ?? 0,
            ).padStart(2, "0")}
          </strong>

          <p>members expected today</p>
        </article>
      </section>

      <section className="dashboard-editorial-grid">
        <article className="dashboard-section dashboard-sessions">
          <div className="dashboard-section-heading">
            <div>
              <p className="dashboard-section-eyebrow">
                SESSIONS
              </p>

              <h2>Today&apos;s Sessions</h2>
            </div>

            <span>
              {formatDate(dashboard?.sessions?.date)}
            </span>
          </div>

          <div className="dashboard-session-list">
            {sessions.length === 0 ? (
              <div className="dashboard-empty">
                No sessions scheduled.
              </div>
            ) : (
              sessions.map((session, index) => (
                <article
                  className="dashboard-session"
                  key={session.session_key}
                >
                  <span className="dashboard-session-index">
                    {String(index + 1).padStart(2, "0")}
                  </span>

                  <div className="dashboard-session-main">
                    <h3>
                      {formatSessionName(
                        session.session_key,
                      )}
                    </h3>

                    <span>
                      {session.start_time} —{" "}
                      {session.end_time}
                    </span>
                  </div>

                  <div className="dashboard-session-capacity">
                    <strong>
                      {session.present ?? 0}
                    </strong>

                    <span>
                      / {session.expected ?? 0}
                    </span>
                  </div>
                </article>
              ))
            )}
          </div>
        </article>

        <article className="dashboard-section dashboard-attention">
          <div className="dashboard-section-heading">
            <div>
              <p className="dashboard-section-eyebrow">
                ATTENTION
              </p>

              <h2>Inactive Members</h2>
            </div>

            <span className="dashboard-count">
              {inactiveMembers.length}
            </span>
          </div>

          <div className="dashboard-attention-list">
            {inactiveMembers.length === 0 ? (
              <div className="dashboard-empty">
                No inactive candidates.
              </div>
            ) : (
              inactiveMembers.slice(0, 5).map((member) => (
                <article
                  className="dashboard-attention-member"
                  key={member.member_id}
                >
                  <div className="dashboard-member-initial">
                    {member.name?.charAt(0)?.toUpperCase() ||
                      "M"}
                  </div>

                  <div>
                    <h3>{member.name}</h3>

                    <span>{member.member_id}</span>
                  </div>

                  <strong>
                    {member.days_since_reference ?? 0}
                    <small>DAYS</small>
                  </strong>
                </article>
              ))
            )}
          </div>
        </article>
      </section>

      <section className="dashboard-bottom-grid">
        <article className="dashboard-section dashboard-list-section">
          <div className="dashboard-section-heading">
            <div>
              <p className="dashboard-section-eyebrow">
                PAYMENTS
              </p>

              <h2>Recent Payments</h2>
            </div>
          </div>

          <div className="dashboard-simple-list">
            {recentPayments.length === 0 ? (
              <div className="dashboard-empty">
                No recent payments.
              </div>
            ) : (
              recentPayments.slice(0, 5).map((payment, index) => (
                <article
                  className="dashboard-simple-item"
                  key={
                    payment.payment_id ||
                    `${payment.member_id}-${index}`
                  }
                >
                  <div className="dashboard-simple-index">
                    {String(index + 1).padStart(2, "0")}
                  </div>

                  <div>
                    <h3>
                      {payment.member_name ||
                        payment.member_id ||
                        "Member"}
                    </h3>

                    <span>
                      {payment.payment_date || "No date"}
                    </span>
                  </div>

                  <strong>
                    {payment.amount ?? "—"}
                  </strong>
                </article>
              ))
            )}
          </div>
        </article>

        <article className="dashboard-section dashboard-list-section">
          <div className="dashboard-section-heading">
            <div>
              <p className="dashboard-section-eyebrow">
                TRANSFORMATIONS
              </p>

              <h2>Recent Progress</h2>
            </div>
          </div>

          <div className="dashboard-simple-list">
            {recentTransformations.length === 0 ? (
              <div className="dashboard-empty">
                No recent transformations.
              </div>
            ) : (
              recentTransformations
                .slice(0, 5)
                .map((transformation, index) => (
                  <article
                    className="dashboard-simple-item"
                    key={
                      transformation.transformation_id ||
                      `${transformation.member_id}-${index}`
                    }
                  >
                    <div className="dashboard-simple-index">
                      {String(index + 1).padStart(2, "0")}
                    </div>

                    <div>
                      <h3>
                        {transformation.member_name ||
                          transformation.member_id ||
                          "Member"}
                      </h3>

                      <span>
                        Week {transformation.week ?? "—"}
                      </span>
                    </div>

                    <strong>
                      {transformation.weight ?? "—"}
                    </strong>
                  </article>
                ))
            )}
          </div>
        </article>
      </section>
    </section>
  );
}

export default DashboardPage;