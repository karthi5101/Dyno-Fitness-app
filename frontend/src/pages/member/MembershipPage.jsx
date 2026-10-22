import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { useAuth } from "../../auth/AuthContext";
import { getMembership } from "../../api/client";

import "./MembershipPage.css";

function formatDate(value) {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date
    .toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    })
    .toUpperCase();
}

function MembershipPage() {
  const { memberId } = useAuth();

  const [membership, setMembership] =
    useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadMembership() {
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

        const response =
          await getMembership(memberId);

        if (!cancelled) {
          setMembership(response);
        }
      } catch (err) {
        if (!cancelled) {
          setMembership(null);

          if (err?.status === 404) {
            setError("");
          } else {
            setError(
              err.message ||
                "Unable to load your membership.",
            );
          }
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadMembership();

    return () => {
      cancelled = true;
    };
  }, [memberId]);

  if (loading) {
    return (
      <section className="member-membership-page">
        <div className="member-membership-loading">
          <span />
          <span />
        </div>
      </section>
    );
  }

  const status = String(
    membership?.status || "none",
  ).toUpperCase();

  return (
    <section className="member-membership-page">
      <header className="member-membership-header">
        <div>
          <Link
            className="member-membership-back"
            to="/member/dashboard"
          >
            ← BACK TO DASHBOARD
          </Link>

          <p>MEMBER / MEMBERSHIP</p>

          <h1>
            YOUR
            <br />
            PLAN.
          </h1>

          <span>
            Everything you need to know about your current
            membership.
          </span>
        </div>

        <div className="member-membership-status">
          <span>STATUS</span>
          <strong>
            {membership ? status : "NONE"}
          </strong>
        </div>
      </header>

      {error && (
        <p className="member-membership-error">
          {error}
        </p>
      )}

      {membership ? (
        <>
          <article className="member-membership-hero">
            <div>
              <p>CURRENT MEMBERSHIP</p>
              <h2>
                {String(
                  membership.plan_name ||
                    "MEMBERSHIP",
                ).toUpperCase()}
              </h2>
              <span>{status} PLAN</span>
            </div>
          </article>

          <section className="member-membership-details">
            <article>
              <span>START DATE</span>
              <strong>
                {formatDate(
                  membership.start_date,
                )}
              </strong>
            </article>

            <article>
              <span>EXPIRES</span>
              <strong>
                {formatDate(
                  membership.end_date,
                )}
              </strong>
            </article>

            <article>
              <span>STATUS</span>
              <strong>{status}</strong>
            </article>
          </section>
        </>
      ) : (
        <article className="member-membership-hero">
          <div>
            <p>CURRENT MEMBERSHIP</p>
            <h2>
              NO
              <br />
              PLAN
              <br />
              YET.
            </h2>
            <span>
              SPEAK WITH THE GYM TO CONTINUE
            </span>
          </div>
        </article>
      )}

      <section className="member-membership-accordion">
        <article>
          <div>
            <span>01</span>
            <strong>YOUR PLAN</strong>
          </div>

          <p>
            Your current gym membership is active. Your
            membership dates are maintained by the gym staff.
          </p>
        </article>

        <article>
          <div>
            <span>02</span>
            <strong>RENEWAL</strong>
          </div>

          <p>
            When your membership approaches expiry, speak
            with the gym to continue your plan.
          </p>
        </article>

        <article>
          <div>
            <span>03</span>
            <strong>PAYMENTS</strong>
          </div>

          <p>
            Payments are recorded by Dyno staff. Online
            payment processing is not enabled in Phase 1.
          </p>
        </article>
      </section>

      <section className="member-membership-banner">
        <p>STAY CONSISTENT.</p>

        <h2>
          YOUR
          <br />
          NEXT
          <br />
          SESSION
          <br />
          STARTS
          <br />
          HERE.
        </h2>
      </section>
    </section>
  );
}

export default MembershipPage;
