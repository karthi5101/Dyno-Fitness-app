import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";

import { useAuth } from "../../auth/AuthContext";

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

  return (
    <main>
      <section>
        <p>DYNO FITNESS</p>

        <h1>Login</h1>

        <p>
          Sign in to access your
          Dyno Fitness account.
        </p>

        <form
          onSubmit={handleSubmit}
        >
          <div>
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
              required
            />
          </div>

          <div>
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
              required
            />
          </div>

          {error && (
            <p role="alert">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
          >
            {submitting
              ? "Signing in..."
              : "Sign in"}
          </button>
        </form>
      </section>
    </main>
  );
}