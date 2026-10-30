import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { getMembers } from "../../api/client";

import MemberProgressSection from "./MemberProgressSection";

import "./ProgressPage.css";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  "http://127.0.0.1:8000/api";

const ACCESS_TOKEN_KEY = "dyno_access_token";

function getAccessToken() {
  return localStorage.getItem(ACCESS_TOKEN_KEY) || "";
}

async function transformationRequest(
  endpoint,
  options = {},
) {
  const token = getAccessToken();

  const response = await fetch(
    `${API_BASE_URL}${endpoint}`,
    {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(token
          ? {
              Authorization: `Bearer ${token}`,
            }
          : {}),
        ...(options.headers || {}),
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
    const detail =
      data?.detail ||
      data?.message ||
      Object.values(data || {})
        .flat()
        .find(
          (value) =>
            typeof value === "string",
        ) ||
      "Unable to complete the transformation request.";

    throw new Error(detail);
  }

  return data;
}

async function getTransformations() {
  return transformationRequest(
    "/transformations/",
  );
}

function getWeek(record) {
  return (
    record?.week_number ??
    record?.week ??
    "—"
  );
}

function getWeight(record) {
  return (
    record?.weight_kg ??
    record?.weight ??
    null
  );
}

function getRecordedDate(record) {
  return (
    record?.recorded_date ||
    record?.date ||
    ""
  );
}

function formatWeight(value) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return "—";
  }

  const numericValue = Number(value);

  if (Number.isNaN(numericValue)) {
    return value;
  }

  return Number.isInteger(numericValue)
    ? String(numericValue)
    : numericValue.toFixed(2);
}

function getInitials(name = "") {
  return (
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) =>
        part.charAt(0).toUpperCase(),
      )
      .join("") || "M"
  );
}

function ProgressPage() {
  const navigate = useNavigate();
  const { memberId } = useParams();

  const [members, setMembers] = useState([]);
  const [transformations, setTransformations] =
    useState([]);

  const [search, setSearch] = useState("");

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState("");

  async function loadProgress() {
    try {
      setLoading(true);
      setError("");

      const [
        membersData,
        transformationsData,
      ] = await Promise.all([
        getMembers(),
        getTransformations(),
      ]);

      setMembers(
        Array.isArray(membersData)
          ? membersData
          : [],
      );

      setTransformations(
        Array.isArray(transformationsData)
          ? transformationsData
          : [],
      );
    } catch (err) {
      setError(
        err?.message ||
          "Unable to load progress.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!memberId) {
      loadProgress();
    }
  }, [memberId]);

  const groupedRecords = useMemo(() => {
    const grouped = new Map();

    transformations.forEach((record) => {
      const currentMemberId =
        record?.member_id;

      if (!currentMemberId) {
        return;
      }

      if (!grouped.has(currentMemberId)) {
        grouped.set(currentMemberId, []);
      }

      grouped
        .get(currentMemberId)
        .push(record);
    });

    return grouped;
  }, [transformations]);

  const trackedMembers = useMemo(() => {
    return members
      .map((member) => {
        const records = [
          ...(groupedRecords.get(
            member.member_id,
          ) || []),
        ].sort((a, b) => {
          const weekDifference =
            Number(getWeek(b) || 0) -
            Number(getWeek(a) || 0);

          if (weekDifference !== 0) {
            return weekDifference;
          }

          return (
            new Date(
              getRecordedDate(b) || 0,
            ).getTime() -
            new Date(
              getRecordedDate(a) || 0,
            ).getTime()
          );
        });

        return {
          memberId: member.member_id,
          member,
          records,
          latest: records[0] || null,
        };
      })
      .sort((a, b) =>
        (
          a.member?.name || ""
        ).localeCompare(
          b.member?.name || "",
        ),
      );
  }, [groupedRecords, members]);

  const filteredMembers = useMemo(() => {
    const query = search
      .trim()
      .toLowerCase();

    if (!query) {
      return trackedMembers;
    }

    return trackedMembers.filter(
      ({ member }) =>
        member?.name
          ?.toLowerCase()
          .includes(query) ||
        member?.member_id
          ?.toLowerCase()
          .includes(query),
    );
  }, [search, trackedMembers]);

  function selectMember(
    currentMemberId,
  ) {
    navigate(
      `/staff/progress/${encodeURIComponent(
        currentMemberId,
      )}`,
    );
  }

  if (memberId) {
    return (
      <MemberProgressSection
        memberId={memberId}
        member={
          members.find(
            (member) =>
              String(member.member_id) ===
              String(memberId),
          ) || null
        }
      />
    );
  }

  if (loading) {
    return (
      <section className="staff-progress-page">
        <div className="staff-progress-loading">
          <span />
          <span />
          <span />
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="staff-progress-page">
        <header className="staff-progress-header">
          <div>
            <p>STAFF — 7</p>

            <h1>
              KEEP
              <br />
              GOING.
            </h1>
          </div>
        </header>

        <div className="staff-progress-error">
          <p>PROGRESS UNAVAILABLE</p>
          <strong>{error}</strong>
        </div>
      </section>
    );
  }

  return (
    <section className="staff-progress-page">
      <header className="staff-progress-header">
        <div>
          <p>STAFF — 7</p>

          <h1>
            KEEP
            <br />
            GOING.
          </h1>

          <span>
            Review member transformation
            records, weekly progress, and
            recent changes.
          </span>
        </div>
      </header>

      <section className="staff-progress-summary">
        <article>
          <span>RECORDS</span>

          <strong>
            {transformations.length}
          </strong>
        </article>

        <article>
          <span>MEMBERS</span>

          <strong>
            {members.length}
          </strong>
        </article>

        <article className="staff-progress-search-card">
          <span>SEARCH</span>

          <input
            type="search"
            value={search}
            onChange={(event) =>
              setSearch(
                event.target.value,
              )
            }
            placeholder="Member name or ID"
          />
        </article>
      </section>

      <section className="staff-progress-member-list">
        <div className="staff-progress-list-heading">
          <span>MEMBER</span>
          <span>UPDATES</span>
          <span>LATEST WEEK</span>
          <span>WEIGHT</span>
          <span />
        </div>

        {filteredMembers.length ===
        0 ? (
          <div className="staff-progress-empty">
            <p>
              NO MEMBERS FOUND
            </p>

            <span>
              Try another member name
              or ID.
            </span>
          </div>
        ) : (
          filteredMembers.map(
            ({
              memberId:
                currentMemberId,
              member,
              records,
              latest,
            }) => (
              <button
                type="button"
                className="staff-progress-member-row"
                key={currentMemberId}
                onClick={() =>
                  selectMember(
                    currentMemberId,
                  )
                }
              >
                <div className="staff-progress-member-cell">
                  <div className="staff-progress-avatar">
                    {getInitials(
                      member?.name ||
                        currentMemberId,
                    )}
                  </div>

                  <div>
                    <strong>
                      {member?.name ||
                        currentMemberId}
                    </strong>

                    <span>
                      {
                        currentMemberId
                      }
                    </span>
                  </div>
                </div>

                <strong>
                  {records.length}
                </strong>

                <strong>
                  {latest
                    ? String(
                        getWeek(latest),
                      ).padStart(
                        2,
                        "0",
                      )
                    : "—"}
                </strong>

                <strong>
                  {formatWeight(
                    getWeight(latest),
                  )}

                  {getWeight(latest) !==
                    null &&
                    getWeight(latest) !==
                      undefined && (
                      <small>
                        {" "}
                        KG
                      </small>
                    )}
                </strong>

                <span className="staff-progress-view">
                  {records.length
                    ? "VIEW PROGRESS →"
                    : "START PROGRESS →"}
                </span>
              </button>
            ),
          )
        )}
      </section>
    </section>
  );
}

export default ProgressPage;
