import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { getAuthHeaders } from "../../api/client";

import "./InactiveMembersPage.css";

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

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data?.detail ||
        data?.message ||
        "Unable to load inactive members.",
    );
  }

  return data;
}

function InactiveMembersPage() {
  const navigate = useNavigate();

  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);

        const data = await request(
          "/inactive-members/",
        );

        setMembers(
          Array.isArray(data)
            ? data
            : data?.value || [],
        );
      } catch (err) {
        setError(
          err.message ||
            "Unable to load inactive members.",
        );
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  if (loading) {
    return (
      <section className="staff-page inactive-page">
        <div className="staff-state">
          <span className="staff-loader" />
          <p>Checking member activity...</p>
        </div>
      </section>
    );
  }

  return (
    <section className="staff-page inactive-page">
      <header className="staff-page-header">
        <div>
          <p className="staff-eyebrow">STAFF — 10</p>
          <h1>CHECK IN.</h1>
          <p>
            Members who may need a follow-up based on
            recent attendance.
          </p>
        </div>
      </header>

      {error && (
        <div className="staff-message staff-message-error">
          {error}
        </div>
      )}

      <div className="inactive-hero">
        <span>NEEDS ATTENTION</span>
        <strong>{members.length}</strong>
        <p>
          No member status is changed automatically.
        </p>
      </div>

      <section className="inactive-list">
        {members.length === 0 ? (
          <div className="staff-empty">
            <strong>Everyone is showing up.</strong>
            <p>
              No active members currently meet the
              inactive threshold.
            </p>
          </div>
        ) : (
          members.map((member) => (
            <article
              className="inactive-row"
              key={member.member_id}
            >
              <div className="inactive-avatar">
                {member.name
                  ?.charAt(0)
                  ?.toUpperCase() || "M"}
              </div>

              <div className="inactive-member">
                <strong>{member.name}</strong>
                <span>{member.member_id}</span>
              </div>

              <div className="inactive-last">
                <span>LAST ATTENDANCE</span>
                <strong>
                  {member.last_attendance ||
                    "No attendance"}
                </strong>
              </div>

              <div className="inactive-days">
                <strong>
                  {member.days_since_reference ??
                    "—"}
                </strong>
                <span>DAYS</span>
              </div>

              <button
                type="button"
                onClick={() =>
                  navigate(
                    `/staff/members/${member.member_id}`,
                  )
                }
              >
                VIEW MEMBER →
              </button>
            </article>
          ))
        )}
      </section>
    </section>
  );
}

export default InactiveMembersPage;