import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { useAuth } from "../../auth/AuthContext";
import { getMember } from "../../api/client";

import "./ProfilePage.css";

const MEMBER_ID =
  localStorage.getItem("dyno_member_id") || "MEM-0001";

const SESSION_LABELS = {
  morning_first: "Morning · First",
  morning_second: "Morning · Second",
  evening_first: "Evening · First",
  evening_second: "Evening · Second",
};

function formatSession(session) {
  return SESSION_LABELS[session] || "Not selected";
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
    month: "long",
    year: "numeric",
  });
}

function getInitials(name = "") {
  return (
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join("") || "M"
  );
}

function ProfilePage() {
  const navigate = useNavigate();
  const { logout } = useAuth();

  const [member, setMember] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadProfile() {
      try {
        setLoading(true);
        setError("");

        const data = await getMember(MEMBER_ID);

        setMember(data?.value || data);
      } catch (err) {
        setError(
          err.message || "Unable to load your profile.",
        );
      } finally {
        setLoading(false);
      }
    }

    loadProfile();
  }, []);

  function handleLogout() {
    logout();

    navigate("/login", {
      replace: true,
    });
  }

  if (loading) {
    return (
      <section className="member-profile-page">
        <div className="member-profile-loading">
          <span />
          <span />
          <span />
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="member-profile-page">
        <div className="member-profile-error">
          <p>PROFILE</p>

          <h1>UNAVAILABLE.</h1>

          <span>{error}</span>

          <button
            type="button"
            className="member-profile-logout"
            onClick={handleLogout}
          >
            LOG OUT
            <span>↗</span>
          </button>
        </div>
      </section>
    );
  }

  const name = member?.name || "Member";

  return (
    <section className="member-profile-page">
      <header className="member-profile-header">
        <Link
          className="member-profile-back"
          to="/member/dashboard"
        >
          ← DASHBOARD
        </Link>

        <span>MEMBER / PROFILE</span>
      </header>

      <section className="member-profile-identity">
        <div className="member-profile-photo">
          {getInitials(name)}
        </div>

        <div>
          <p>YOUR ACCOUNT</p>

          <h1>{name}</h1>

          <span>{MEMBER_ID}</span>
        </div>

        <div className="member-profile-status">
          <span>STATUS</span>

          <strong>
            {(member?.status || "active").toUpperCase()}
          </strong>
        </div>
      </section>

      <section className="member-profile-grid">
        <article>
          <p>PERSONAL</p>

          <h2>DETAILS</h2>

          <dl>
            <div>
              <dt>PHONE</dt>

              <dd>
                {member?.phone || "Not provided"}
              </dd>
            </div>

            <div>
              <dt>EMAIL</dt>

              <dd>
                {member?.email || "Not provided"}
              </dd>
            </div>

            <div>
              <dt>DATE OF BIRTH</dt>

              <dd>
                {formatDate(member?.date_of_birth)}
              </dd>
            </div>

            <div>
              <dt>GENDER</dt>

              <dd>
                {member?.gender || "Not provided"}
              </dd>
            </div>
          </dl>
        </article>

        <article>
          <p>GYM</p>

          <h2>DETAILS</h2>

          <dl>
            <div>
              <dt>MEMBER SINCE</dt>

              <dd>
                {formatDate(member?.joining_date)}
              </dd>
            </div>

            <div>
              <dt>DEFAULT SESSION</dt>

              <dd>
                {formatSession(
                  member?.preferred_session,
                )}
              </dd>
            </div>

            <div>
              <dt>MEMBER ID</dt>

              <dd>
                {member?.member_id || MEMBER_ID}
              </dd>
            </div>

            <div>
              <dt>ACCOUNT STATUS</dt>

              <dd>
                {(member?.status || "active").toUpperCase()}
              </dd>
            </div>
          </dl>
        </article>
      </section>

      <section className="member-profile-emergency">
        <div>
          <p>EMERGENCY CONTACT</p>

          <h3>
            YOUR SAFETY
            <br />
            MATTERS.
          </h3>
        </div>

        <dl>
          <div>
            <dt>NAME</dt>

            <dd>
              {member?.emergency_contact?.name ||
                "Not provided"}
            </dd>
          </div>

          <div>
            <dt>PHONE</dt>

            <dd>
              {member?.emergency_contact?.phone ||
                "Not provided"}
            </dd>
          </div>
        </dl>
      </section>

      <section className="member-profile-account-actions">
        <div>
          <p>ACCOUNT</p>

          <h2>
            FINISHED
            <br />
            TRAINING?
          </h2>
        </div>

        <button
          type="button"
          className="member-profile-logout"
          onClick={handleLogout}
        >
          LOG OUT
          <span>↗</span>
        </button>
      </section>
    </section>
  );
}

export default ProfilePage;