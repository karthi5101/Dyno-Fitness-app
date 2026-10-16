
import { Link } from "react-router-dom";

import "./MembershipPage.css";

function MembershipPage() {
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
          <strong>ACTIVE</strong>
        </div>
      </header>

      <article className="member-membership-hero">
        <div>
          <p>CURRENT MEMBERSHIP</p>
          <h2>QUARTERLY</h2>
          <span>ACTIVE PLAN</span>
        </div>
      </article>

      <section className="member-membership-details">
        <article>
          <span>START DATE</span>
          <strong>11 SEP 2026</strong>
        </article>

        <article>
          <span>EXPIRES</span>
          <strong>10 OCT 2026</strong>
        </article>

        <article>
          <span>STATUS</span>
          <strong>ACTIVE</strong>
        </article>
      </section>

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

