import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { useAuth } from "../../auth/AuthContext";
import {
  changePassword,
  getMember,
  getSessionOptions,
  updatePreferredSession,
} from "../../api/client";

import "./ProfilePage.css";

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
  const { logout, memberId } = useAuth();

  const [member, setMember] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [sessions, setSessions] = useState([]);
  const [sessionSaving, setSessionSaving] =
    useState(false);
  const [sessionMessage, setSessionMessage] =
    useState("");

  const [passwordOpen, setPasswordOpen] =
    useState(false);
  const [passwordSaving, setPasswordSaving] =
    useState(false);
  const [passwordError, setPasswordError] =
    useState("");
  const [passwordSuccess, setPasswordSuccess] =
    useState("");

  const [passwords, setPasswords] = useState({
    oldPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  useEffect(() => {
    async function loadProfile() {
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

        const [memberData, sessionData] =
          await Promise.all([
            getMember(memberId),
            getSessionOptions(),
          ]);

        setMember(memberData?.value || memberData);

        setSessions(
          Array.isArray(sessionData?.sessions)
            ? sessionData.sessions
            : [],
        );
      } catch (err) {
        setError(
          err.message || "Unable to load your profile.",
        );
      } finally {
        setLoading(false);
      }
    }

    loadProfile();
  }, [memberId]);

  function handleLogout() {
    logout();

    navigate("/login", {
      replace: true,
    });
  }

  async function handleSessionChange(event) {
    const sessionKey = event.target.value;

    if (!sessionKey) {
      return;
    }

    try {
      setSessionSaving(true);
      setSessionMessage("");

      const response =
        await updatePreferredSession(sessionKey);

      const savedSession =
        response?.preferred_session || sessionKey;

      setMember((current) => ({
        ...(current || {}),
        preferred_session: savedSession,
      }));

      setSessionMessage(
        "Default session updated.",
      );
    } catch (err) {
      setSessionMessage(
        err.message ||
          "Unable to update your session.",
      );
    } finally {
      setSessionSaving(false);
    }
  }

  function handlePasswordChange(event) {
    const { name, value } = event.target;

    setPasswords((current) => ({
      ...current,
      [name]: value,
    }));

    setPasswordError("");
    setPasswordSuccess("");
  }

  function togglePasswordForm() {
    setPasswordOpen((current) => !current);
    setPasswordError("");
    setPasswordSuccess("");
    setPasswords({
      oldPassword: "",
      newPassword: "",
      confirmPassword: "",
    });
  }

  async function handlePasswordSubmit(event) {
    event.preventDefault();

    const { oldPassword, newPassword, confirmPassword } =
      passwords;

    if (!oldPassword || !newPassword) {
      setPasswordError(
        "Enter your current password and a new password.",
      );

      return;
    }

    if (newPassword.length < 8) {
      setPasswordError(
        "Your new password must be at least 8 characters.",
      );

      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError(
        "The new passwords do not match.",
      );

      return;
    }

    try {
      setPasswordSaving(true);
      setPasswordError("");
      setPasswordSuccess("");

      await changePassword(
        oldPassword,
        newPassword,
      );

      setPasswordSuccess(
        "Password updated. Use it the next time you sign in.",
      );

      setPasswords({
        oldPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
    } catch (err) {
      setPasswordError(
        err.message ||
          "Unable to update your password.",
      );
    } finally {
      setPasswordSaving(false);
    }
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

          <span>{memberId}</span>
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

            <div className="member-profile-session-row">
              <dt>DEFAULT SESSION</dt>

              <dd>
                <select
                  className="member-profile-session-select"
                  value={
                    member?.preferred_session || ""
                  }
                  onChange={handleSessionChange}
                  disabled={sessionSaving}
                  aria-label="Default gym session"
                >
                  <option value="">
                    Not selected
                  </option>

                  {sessions.map((session) => (
                    <option
                      key={session.session_key}
                      value={session.session_key}
                    >
                      {session.name ||
                        formatSession(
                          session.session_key,
                        )} ({session.start_time}
                      -{session.end_time})
                    </option>
                  ))}
                </select>

                {sessionMessage && (
                  <small className="member-profile-session-message">
                    {sessionMessage}
                  </small>
                )}
              </dd>
            </div>

            <div>
              <dt>MEMBER ID</dt>

              <dd>
                {member?.member_id || memberId}
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

      {passwordOpen && (
        <section className="member-profile-password">
          <div>
            <p>ACCOUNT SECURITY</p>

            <h3>
              CHANGE
              <br />
              PASSWORD.
            </h3>
          </div>

          <form
            onSubmit={handlePasswordSubmit}
          >
            {passwordError && (
              <p className="member-profile-password-error">
                {passwordError}
              </p>
            )}

            {passwordSuccess && (
              <p className="member-profile-password-success">
                {passwordSuccess}
              </p>
            )}

            <label>
              CURRENT PASSWORD
              <input
                type="password"
                name="oldPassword"
                value={passwords.oldPassword}
                onChange={handlePasswordChange}
                autoComplete="current-password"
                disabled={passwordSaving}
                required
              />
            </label>

            <label>
              NEW PASSWORD
              <input
                type="password"
                name="newPassword"
                value={passwords.newPassword}
                onChange={handlePasswordChange}
                autoComplete="new-password"
                minLength={8}
                disabled={passwordSaving}
                required
              />
            </label>

            <label>
              CONFIRM NEW PASSWORD
              <input
                type="password"
                name="confirmPassword"
                value={passwords.confirmPassword}
                onChange={handlePasswordChange}
                autoComplete="new-password"
                minLength={8}
                disabled={passwordSaving}
                required
              />
            </label>

            <div className="member-profile-password-actions">
              <button
                type="submit"
                className="member-profile-logout"
                disabled={passwordSaving}
              >
                {passwordSaving
                  ? "SAVING..."
                  : "UPDATE PASSWORD"}
                <span>↗</span>
              </button>

              <button
                type="button"
                className="member-profile-logout member-profile-logout-quiet"
                onClick={togglePasswordForm}
                disabled={passwordSaving}
              >
                CANCEL
              </button>
            </div>
          </form>
        </section>
      )}

      <section className="member-profile-account-actions">
        <div>
          <p>ACCOUNT</p>

          <h2>
            FINISHED
            <br />
            TRAINING?
          </h2>
        </div>

        <div className="member-profile-account-buttons">
          <button
            type="button"
            className="member-profile-logout member-profile-logout-quiet"
            onClick={togglePasswordForm}
          >
            {passwordOpen
              ? "CLOSE PASSWORD"
              : "CHANGE PASSWORD"}
            <span>↗</span>
          </button>

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
    </section>
  );
}

export default ProfilePage;
