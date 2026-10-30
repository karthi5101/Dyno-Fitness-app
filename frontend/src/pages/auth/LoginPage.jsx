import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import "./LoginPage.css";
import { useAuth } from "../../auth/AuthContext";
import { recoverPassword } from "../../api/client";

export default function LoginPage() {
  const navigate = useNavigate();

  const {
    login,
    isAuthenticated,
    role,
  } = useAuth();

  const [username, setUsername] =
    useState("");

  const [password, setPassword] =
    useState("");

  const [error, setError] =
    useState("");

  const [submitting, setSubmitting] =
    useState(false);

  const [recoveryOpen, setRecoveryOpen] =
    useState(false);

  const [recoveryMemberId, setRecoveryMemberId] =
    useState("");

  const [recoveryAnswer, setRecoveryAnswer] =
    useState("");

  const [recoveryPassword, setRecoveryPassword] =
    useState("");

  const [recoveryConfirm, setRecoveryConfirm] =
    useState("");

  const [recoveryError, setRecoveryError] =
    useState("");

  const [recoverySuccess, setRecoverySuccess] =
    useState("");

  const [recoverySubmitting, setRecoverySubmitting] =
    useState(false);

  if (isAuthenticated) {
    return (
      <Navigate
        to={
          role === "staff"
            ? "/staff/dashboard"
            : "/member/dashboard"
        }
        replace
      />
    );
  }

  async function handleSubmit(event) {
    event.preventDefault();

    setError("");
    setSubmitting(true);

    try {
      const data = await login(
        username,
        password,
      );

      const accountRole =
        data.user?.role || "member";

      navigate(
        accountRole === "staff"
          ? "/staff/dashboard"
          : "/member/dashboard",
        {
          replace: true,
        },
      );
    } catch (requestError) {
      setError(
        requestError.message ||
          "Unable to sign in.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  function openRecovery() {
    setRecoveryOpen(true);
    setRecoveryMemberId(username.trim());
    setRecoveryAnswer("");
    setRecoveryPassword("");
    setRecoveryConfirm("");
    setRecoveryError("");
    setRecoverySuccess("");
  }

  function closeRecovery() {
    setRecoveryOpen(false);
    setRecoveryError("");
    setRecoverySuccess("");
  }

  async function handleRecoverySubmit(event) {
    event.preventDefault();

    setRecoveryError("");
    setRecoverySuccess("");

    if (!recoveryMemberId.trim()) {
      setRecoveryError("Enter your member ID.");
      return;
    }

    if (!recoveryAnswer.trim()) {
      setRecoveryError(
        "Answer the school security question.",
      );
      return;
    }

    if (recoveryPassword.length < 8) {
      setRecoveryError(
        "Your new password must be at least 8 characters.",
      );
      return;
    }

    if (recoveryPassword !== recoveryConfirm) {
      setRecoveryError(
        "The new passwords do not match.",
      );
      return;
    }

    try {
      setRecoverySubmitting(true);

      const data = await recoverPassword(
        recoveryMemberId.trim(),
        recoveryAnswer,
        recoveryPassword,
      );

      setRecoverySuccess(
        data?.detail ||
          "Password reset successfully.",
      );
      setRecoveryAnswer("");
      setRecoveryPassword("");
      setRecoveryConfirm("");
    } catch (requestError) {
      setRecoveryError(
        requestError.message ||
          "Unable to reset this password.",
      );
    } finally {
      setRecoverySubmitting(false);
    }
  }

  return (
    <main className="dyno-login">
      <aside className="dyno-login-brand">
        <div className="dyno-login-brand-top">
          <span
            className="dyno-login-mark"
            aria-hidden="true"
          >
            D
          </span>

          <div className="dyno-login-brand-identity">
            <strong className="dyno-login-brand-name">
              DYNO FITNESS
            </strong>

            <span className="dyno-login-brand-tagline">
              Member &amp; staff access
            </span>
          </div>
        </div>

        <div className="dyno-login-brand-copy">
          <p className="dyno-login-eyebrow">
            Training / Nutrition / Progress
          </p>

          <h2 className="dyno-login-brand-heading">
            BUILT THROUGH
            <br />
            <span>CONSISTENCY.</span>
          </h2>

          <p className="dyno-login-brand-description">
            One place for your training,
            nutrition, attendance and
            long-term progress.
          </p>
        </div>

        <div className="dyno-login-brand-footer">
          <span>Dyno Fitness</span>
          <span>Performance Studio</span>
        </div>
      </aside>

      <section className="dyno-login-panel">
        <div className="dyno-login-card">
          {recoveryOpen ? (
            <>
              <p className="dyno-login-eyebrow">
                Account recovery
              </p>

              <h1 className="dyno-login-heading">
                Recover.
              </h1>

              <p className="dyno-login-intro">
                Verify your member ID and school
                answer to set a new password.
              </p>

              <form
                className="dyno-login-form"
                onSubmit={handleRecoverySubmit}
              >
                <div className="dyno-login-field">
                  <label htmlFor="recovery-member-id">
                    Member ID
                  </label>

                  <input
                    id="recovery-member-id"
                    type="text"
                    value={recoveryMemberId}
                    onChange={(event) =>
                      setRecoveryMemberId(
                        event.target.value,
                      )
                    }
                    autoComplete="username"
                    placeholder="Enter your member ID"
                    disabled={recoverySubmitting}
                    required
                  />
                </div>

                <div className="dyno-login-field">
                  <label htmlFor="recovery-answer">
                    School security answer
                  </label>

                  <input
                    id="recovery-answer"
                    type="text"
                    value={recoveryAnswer}
                    onChange={(event) =>
                      setRecoveryAnswer(
                        event.target.value,
                      )
                    }
                    autoComplete="off"
                    placeholder="Which school did you study?"
                    disabled={recoverySubmitting}
                    required
                  />
                </div>

                <div className="dyno-login-field">
                  <label htmlFor="recovery-password">
                    New password
                  </label>

                  <input
                    id="recovery-password"
                    type="password"
                    value={recoveryPassword}
                    onChange={(event) =>
                      setRecoveryPassword(
                        event.target.value,
                      )
                    }
                    autoComplete="new-password"
                    placeholder="At least 8 characters"
                    minLength={8}
                    disabled={recoverySubmitting}
                    required
                  />
                </div>

                <div className="dyno-login-field">
                  <label htmlFor="recovery-confirm">
                    Confirm new password
                  </label>

                  <input
                    id="recovery-confirm"
                    type="password"
                    value={recoveryConfirm}
                    onChange={(event) =>
                      setRecoveryConfirm(
                        event.target.value,
                      )
                    }
                    autoComplete="new-password"
                    placeholder="Repeat your new password"
                    minLength={8}
                    disabled={recoverySubmitting}
                    required
                  />
                </div>

                {recoveryError && (
                  <p
                    className="dyno-login-error"
                    role="alert"
                  >
                    {recoveryError}
                  </p>
                )}

                {recoverySuccess && (
                  <p
                    className="dyno-login-recovery-success"
                    role="status"
                  >
                    {recoverySuccess}
                  </p>
                )}

                <button
                  type="submit"
                  className="dyno-login-submit"
                  disabled={recoverySubmitting}
                >
                  <span>
                    {recoverySubmitting
                      ? "Resetting..."
                      : "Reset password"}
                  </span>

                  {recoverySubmitting ? (
                    <span
                      className="dyno-login-submit-spinner"
                      aria-hidden="true"
                    />
                  ) : (
                    <span
                      className="dyno-login-submit-arrow"
                      aria-hidden="true"
                    >
                      →
                    </span>
                  )}
                </button>
              </form>

              <button
                type="button"
                className="dyno-login-recovery-back"
                onClick={closeRecovery}
              >
                ← Back to sign in
              </button>

              <p className="dyno-login-footnote">
                Two successful recoveries within 15
                days require staff reactivation.
              </p>
            </>
          ) : (
            <>
              <p className="dyno-login-eyebrow">
                Welcome back
              </p>

              <h1 className="dyno-login-heading">
                Login
              </h1>

              <p className="dyno-login-intro">
                Sign in to access your
                Dyno Fitness account.
              </p>

              <form
                className="dyno-login-form"
                onSubmit={handleSubmit}
              >
                <div className="dyno-login-field">
                  <label htmlFor="username">
                    Username
                  </label>

                  <input
                    id="username"
                    type="text"
                    value={username}
                    onChange={(event) =>
                      setUsername(
                        event.target.value,
                      )
                    }
                    autoComplete="username"
                    placeholder="Enter your username"
                    required
                  />
                </div>

                <div className="dyno-login-field">
                  <label htmlFor="password">
                    Password
                  </label>

                  <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(event) =>
                      setPassword(
                        event.target.value,
                      )
                    }
                    autoComplete="current-password"
                    placeholder="Enter your password"
                    required
                  />
                </div>

                {error && (
                  <p
                    className="dyno-login-error"
                    role="alert"
                  >
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  className="dyno-login-submit"
                  disabled={submitting}
                >
                  <span>
                    {submitting
                      ? "Signing in..."
                      : "Sign in"}
                  </span>

                  {submitting ? (
                    <span
                      className="dyno-login-submit-spinner"
                      aria-hidden="true"
                    />
                  ) : (
                    <span
                      className="dyno-login-submit-arrow"
                      aria-hidden="true"
                    >
                      →
                    </span>
                  )}
                </button>
              </form>

              <button
                type="button"
                className="dyno-login-forgot"
                onClick={openRecovery}
              >
                Forgot password?
              </button>

              <p className="dyno-login-footnote">
                Secure access · Members &amp;
                staff
              </p>
            </>
          )}
        </div>
      </section>
    </main>
  );
}