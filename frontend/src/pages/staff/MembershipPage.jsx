import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { getMembers } from "../../api/client";
import { getAuthHeaders } from "../../api/client";

import "./MembershipPage.css";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  "http://127.0.0.1:8000/api";

async function request(endpoint) {
  const response = await fetch(
    `${API_BASE_URL}${endpoint}`,
    {
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeaders(),
      },
    },
  );

  let data = null;

  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    throw new Error(
      data?.detail ||
        data?.message ||
        "Unable to load membership data.",
    );
  }

  return data;
}

function daysUntil(dateValue) {
  if (!dateValue) {
    return null;
  }

  const today = new Date();
  const target = new Date(dateValue);

  today.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);

  return Math.ceil(
    (target - today) / 86400000,
  );
}

function MembershipPage() {
  const navigate = useNavigate();

  const [members, setMembers] = useState([]);
  const [memberships, setMemberships] =
    useState([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);

        const [memberData, membershipData] =
          await Promise.all([
            getMembers(),
            request("/memberships/"),
          ]);

        setMembers(memberData || []);
        setMemberships(
          Array.isArray(membershipData)
            ? membershipData
            : membershipData?.value || [],
        );
      } catch (err) {
        setError(
          err.message ||
            "Unable to load memberships.",
        );
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  const memberMap = useMemo(
    () =>
      new Map(
        members.map((member) => [
          member.member_id,
          member,
        ]),
      ),
    [members],
  );

  const filtered = memberships.filter(
    (membership) => {
      const member = memberMap.get(
        membership.member_id,
      );

      const days = daysUntil(
        membership.end_date,
      );

      const derived =
        days !== null && days < 0
          ? "expired"
          : days !== null && days <= 7
            ? "expiring"
            : membership.status || "active";

      const query = search.trim().toLowerCase();

      const matchesSearch =
        !query ||
        [
          membership.member_id,
          membership.plan_name,
          member?.name,
          member?.phone,
        ]
          .filter(Boolean)
          .some((value) =>
            String(value)
              .toLowerCase()
              .includes(query),
          );

      const matchesFilter =
        filter === "all" ||
        derived === filter;

      return matchesSearch && matchesFilter;
    },
  );

  if (loading) {
    return (
      <section className="staff-page membership-page">
        <div className="staff-state">
          <span className="staff-loader" />
          <p>Loading memberships...</p>
        </div>
      </section>
    );
  }

  return (
    <section className="staff-page membership-page">
      <header className="staff-page-header">
        <div>
          <p className="staff-eyebrow">STAFF — 8</p>
          <h1>YOUR PLAN.</h1>
          <p>
            Track active plans, upcoming renewals,
            and expired memberships.
          </p>
        </div>
      </header>

      {error && (
        <div className="staff-message staff-message-error">
          {error}
        </div>
      )}

      <div className="membership-toolbar">
        <input
          type="search"
          placeholder="Search member or plan..."
          value={search}
          onChange={(event) =>
            setSearch(event.target.value)
          }
        />

        <div className="membership-filters">
          {["all", "active", "expiring", "expired"].map(
            (item) => (
              <button
                type="button"
                key={item}
                className={
                  filter === item
                    ? "active"
                    : ""
                }
                onClick={() =>
                  setFilter(item)
                }
              >
                {item}
              </button>
            ),
          )}
        </div>
      </div>

      <section className="membership-list">
        {filtered.length === 0 ? (
          <div className="staff-empty">
            <strong>No memberships found.</strong>
          </div>
        ) : (
          filtered.map((membership) => {
            const member = memberMap.get(
              membership.member_id,
            );

            const days = daysUntil(
              membership.end_date,
            );

            return (
              <article
                className="membership-row"
                key={
                  membership._id ||
                  membership.member_id
                }
              >
                <button
                  type="button"
                  className="membership-member"
                  onClick={() =>
                    navigate(
                      `/staff/members/${membership.member_id}`,
                    )
                  }
                >
                  <span className="membership-avatar">
                    {member?.name
                      ?.charAt(0)
                      ?.toUpperCase() || "M"}
                  </span>

                  <span>
                    <strong>
                      {member?.name ||
                        membership.member_id}
                    </strong>

                    <small>
                      {membership.member_id}
                    </small>
                  </span>
                </button>

                <div className="membership-plan">
                  <span>PLAN</span>
                  <strong>
                    {membership.plan_name ||
                      membership.plan ||
                      "—"}
                  </strong>
                </div>

                <div className="membership-dates">
                  <span>ENDS</span>
                  <strong>
                    {membership.end_date || "—"}
                  </strong>
                </div>

                <div className="membership-state">
                  <strong>
                    {days === null
                      ? membership.status ||
                        "ACTIVE"
                      : days < 0
                        ? "EXPIRED"
                        : days <= 7
                          ? "EXPIRING"
                          : "ACTIVE"}
                  </strong>

                  <span>
                    {days === null
                      ? ""
                      : days < 0
                        ? `${Math.abs(days)} days ago`
                        : `${days} days left`}
                  </span>
                </div>
              </article>
            );
          })
        )}
      </section>
    </section>
  );
}

export default MembershipPage;