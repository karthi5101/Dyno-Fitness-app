import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";

import {
  createAttendance,
  deleteAttendance,
  getAttendance,
  getMember,
  getMemberAttendance,
} from "../../api/client";

import MemberDietSection from "./MemberDietSection";
import MemberWorkoutSection from "./MemberWorkoutSection";

import "./MemberProfilePage.css";

const PROFILE_SECTIONS = [
  {
    key: "overview",
    label: "OVERVIEW",
    description: "Member snapshot",
  },
  {
    key: "attendance",
    label: "ATTENDANCE",
    description: "Gym visits",
  },
  {
    key: "workout",
    label: "WORKOUT",
    description: "Training plan",
  },
  {
    key: "diet",
    label: "DIET",
    description: "Nutrition plan",
  },
  {
    key: "progress",
    label: "PROGRESS",
    description: "Transformation",
  },
  {
    key: "membership",
    label: "MEMBERSHIP",
    description: "Plan & validity",
  },
  {
    key: "payments",
    label: "PAYMENTS",
    description: "Payment history",
  },
  {
    key: "notes",
    label: "NOTES",
    description: "Staff notes",
  },
];

const SESSION_LABELS = {
  morning_first: "Morning · 05:30–07:30",
  morning_second: "Morning · 07:30–09:30",
  evening_first: "Evening · 17:30–19:30",
  evening_second: "Evening · 19:30–21:30",
};

function getInitials(name) {
  if (!name) {
    return "DF";
  }

  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function formatDate(value) {
  if (!value) {
    return "NOT RECORDED";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value).toUpperCase();
  }

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
    .format(date)
    .toUpperCase();
}

function formatTime(value) {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return new Intl.DateTimeFormat("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function calculateMembershipAge(joiningDate) {
  if (!joiningDate) {
    return "—";
  }

  const start = new Date(joiningDate);
  const today = new Date();

  if (Number.isNaN(start.getTime())) {
    return "—";
  }

  let months =
    (today.getFullYear() -
      start.getFullYear()) *
      12 +
    (today.getMonth() -
      start.getMonth());

  if (today.getDate() < start.getDate()) {
    months -= 1;
  }

  return `${Math.max(months, 0)} ${
    months === 1 ? "MONTH" : "MONTHS"
  }`;
}

function normalizeMemberResponse(response) {
  return (
    response?.value ||
    response?.data ||
    response
  );
}

function normalizeAttendanceResponse(
  response,
) {
  if (Array.isArray(response)) {
    return response;
  }

  if (Array.isArray(response?.value)) {
    return response.value;
  }

  if (Array.isArray(response?.data)) {
    return response.data;
  }

  return [];
}

function MemberProfilePage() {
  const { memberId } = useParams();

  const [member, setMember] =
    useState(null);

  const [activeSection, setActiveSection] =
    useState("overview");

  const [attendance, setAttendance] =
    useState([]);

  const [
    attendanceLoading,
    setAttendanceLoading,
  ] = useState(false);

  const [
    attendanceError,
    setAttendanceError,
  ] = useState("");

  const [
    attendanceSaving,
    setAttendanceSaving,
  ] = useState(false);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const [
    attendanceStatus,
    setAttendanceStatus,
  ] = useState("present");

  useEffect(() => {
    let cancelled = false;

    async function loadMember() {
      try {
        setLoading(true);
        setError("");

        const response =
          await getMember(memberId);

        const normalizedMember =
          normalizeMemberResponse(
            response,
          );

        if (!cancelled) {
          setMember(
            normalizedMember,
          );
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err.message ||
              "We couldn't load this member's profile.",
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    if (memberId) {
      loadMember();
    } else {
      setError(
        "No member ID was provided.",
      );
      setLoading(false);
    }

    return () => {
      cancelled = true;
    };
  }, [memberId]);

  useEffect(() => {
    if (
      activeSection !== "attendance" ||
      !memberId
    ) {
      return;
    }

    let cancelled = false;

    async function loadAttendance() {
      try {
        setAttendanceLoading(true);
        setAttendanceError("");

        let response;

        try {
          response =
            await getMemberAttendance(
              memberId,
            );
        } catch {
          response =
            await getAttendance();
        }

        const records =
          normalizeAttendanceResponse(
            response,
          );

        const memberRecords =
          records.filter(
            (record) =>
              String(
                record?.member_id,
              ) === String(memberId),
          );

        if (!cancelled) {
          setAttendance(
            memberRecords,
          );
        }
      } catch (err) {
        if (!cancelled) {
          setAttendanceError(
            err.message ||
              "We couldn't load this member's attendance.",
          );
        }
      } finally {
        if (!cancelled) {
          setAttendanceLoading(false);
        }
      }
    }

    loadAttendance();

    return () => {
      cancelled = true;
    };
  }, [activeSection, memberId]);

  const isActive =
    String(
      member?.status || "",
    ).toLowerCase() === "active";

  const sessionLabel = useMemo(() => {
    return (
      SESSION_LABELS[
        member?.preferred_session
      ] ||
      "SESSION NOT SELECTED"
    );
  }, [member?.preferred_session]);

  const attendanceStats = useMemo(() => {
    const presentRecords =
      attendance.filter(
        (record) =>
          String(
            record?.status || "",
          ).toLowerCase() ===
          "present",
      );

    const sorted = [...attendance].sort(
      (first, second) =>
        new Date(
          second?.check_in_time ||
            second?.attendance_date ||
            0,
        ) -
        new Date(
          first?.check_in_time ||
            first?.attendance_date ||
            0,
        ),
    );

    const latest =
      sorted[0] || null;

    return {
      total: attendance.length,
      present:
        presentRecords.length,
      latest,
    };
  }, [attendance]);

  async function handleMemberCheckIn() {
    if (!memberId) {
      return;
    }

    try {
      setAttendanceSaving(true);
      setAttendanceError("");

      const now = new Date();

      const createdRecord =
        await createAttendance({
          member_id: memberId,
          attendance_date: now
            .toISOString()
            .slice(0, 10),
          status:
            attendanceStatus,
          check_in_time:
            now.toISOString(),
        });

      setAttendance(
        (current) => [
          createdRecord,
          ...current,
        ],
      );
    } catch (err) {
      setAttendanceError(
        err.message ||
          "We couldn't record attendance.",
      );
    } finally {
      setAttendanceSaving(false);
    }
  }

  async function handleDeleteAttendance(
    attendanceId,
  ) {
    if (!attendanceId) {
      return;
    }

    const confirmed =
      window.confirm(
        "Delete this attendance record?",
      );

    if (!confirmed) {
      return;
    }

    try {
      setAttendanceError("");

      await deleteAttendance(
        attendanceId,
      );

      setAttendance(
        (current) =>
          current.filter(
            (record) =>
              String(
                record?._id ||
                  record?.id,
              ) !==
              String(attendanceId),
          ),
      );
    } catch (err) {
      setAttendanceError(
        err.message ||
          "We couldn't delete this attendance record.",
      );
    }
  }

  function handleSectionChange(
    sectionKey,
  ) {
    setActiveSection(sectionKey);
  }

  if (loading) {
    return (
      <section className="member-profile-page member-profile-loading">
        <div className="member-profile-loading-top">
          <div className="member-profile-skeleton member-profile-skeleton-small" />

          <div className="member-profile-skeleton member-profile-skeleton-button" />
        </div>

        <div className="member-profile-loading-hero">
          <div className="member-profile-skeleton member-profile-skeleton-avatar" />

          <div className="member-profile-loading-lines">
            <div className="member-profile-skeleton member-profile-skeleton-eyebrow" />

            <div className="member-profile-skeleton member-profile-skeleton-name" />

            <div className="member-profile-skeleton member-profile-skeleton-meta" />
          </div>
        </div>

        <div className="member-profile-loading-grid">
          {Array.from({
            length: 6,
          }).map((_, index) => (
            <div
              className="member-profile-skeleton-card"
              key={index}
            >
              <div className="member-profile-skeleton skeleton-card-label" />

              <div className="member-profile-skeleton skeleton-card-value" />
            </div>
          ))}
        </div>
      </section>
    );
  }

  if (error || !member) {
    return (
      <section className="member-profile-page member-profile-error-page">
        <div className="member-profile-error-card">
          <span className="member-profile-error-mark">
            !
          </span>

          <p className="member-profile-eyebrow">
            MEMBER RECORD
          </p>

          <h1>
            MEMBER NOT FOUND.
          </h1>

          <p>
            {error ||
              "This member record could not be loaded."}
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="member-profile-page">
      <header className="member-profile-topbar">
        <div className="member-profile-topbar-meta">
          <span>
            STAFF / MEMBER PROFILE
          </span>

          <strong>
            {member.member_id}
          </strong>
        </div>
      </header>

      <section className="member-profile-hero">
        <div className="member-profile-hero-identity">
          <div className="member-profile-avatar">
            {getInitials(member.name)}
          </div>

          <div className="member-profile-hero-copy">
            <p className="member-profile-eyebrow">
              {member.member_id}
            </p>

            <h1>
              {member.name ||
                "UNNAMED MEMBER"}
            </h1>

            <div className="member-profile-hero-meta">
              <span
                className={
                  isActive
                    ? "member-profile-status member-profile-status-active"
                    : "member-profile-status member-profile-status-inactive"
                }
              >
                {isActive
                  ? "ACTIVE"
                  : "INACTIVE"}
              </span>

              <span>
                JOINED{" "}
                {formatDate(
                  member.joining_date,
                )}
              </span>

              <span>
                {sessionLabel}
              </span>
            </div>
          </div>
        </div>

        <div className="member-profile-hero-side">
          <span>
            MEMBER SINCE
          </span>

          <strong>
            {calculateMembershipAge(
              member.joining_date,
            )}
          </strong>
        </div>
      </section>

      <nav
        className="member-profile-navigation"
        aria-label="Member profile sections"
      >
        {PROFILE_SECTIONS.map(
          (section) => (
            <button
              type="button"
              key={section.key}
              className={
                activeSection ===
                section.key
                  ? "is-active"
                  : ""
              }
              onClick={() =>
                handleSectionChange(
                  section.key,
                )
              }
            >
              <span>
                {section.label}
              </span>

              <small>
                {section.description}
              </small>
            </button>
          ),
        )}
      </nav>

      <main className="member-profile-content">
        {activeSection ===
          "overview" && (
          <div className="member-profile-overview">
            <div className="member-profile-section-heading">
              <div>
                <p className="member-profile-eyebrow">
                  MEMBER / OVERVIEW
                </p>

                <h2>
                  THE COMPLETE PICTURE.
                </h2>
              </div>

              <p>
                Core information first.
                Operational records live
                inside the sections above.
              </p>
            </div>

            <div className="member-profile-overview-grid">
              <article className="member-profile-feature-card member-profile-feature-card-dark">
                <div>
                  <p>
                    STATUS
                  </p>

                  <strong>
                    {isActive
                      ? "ACTIVE."
                      : "INACTIVE."}
                  </strong>
                </div>

                <span>
                  {isActive
                    ? "Currently part of the active member base."
                    : "Currently outside the active member base."}
                </span>
              </article>

              <article className="member-profile-feature-card">
                <p>
                  GYM SESSION
                </p>

                <strong>
                  {sessionLabel}
                </strong>

                <span>
                  The member's selected
                  session remains their
                  default until they change
                  it.
                </span>
              </article>

              <article className="member-profile-feature-card">
                <p>
                  JOINING DATE
                </p>

                <strong>
                  {formatDate(
                    member.joining_date,
                  )}
                </strong>

                <span>
                  Member relationship
                  started on this date.
                </span>
              </article>
            </div>

            <div className="member-profile-details-section">
              <div className="member-profile-section-heading compact">
                <div>
                  <p className="member-profile-eyebrow">
                    PERSONAL
                  </p>

                  <h2>
                    MEMBER DETAILS.
                  </h2>
                </div>
              </div>

              <div className="member-profile-details-grid">
                <DetailItem
                  label="FULL NAME"
                  value={member.name}
                />

                <DetailItem
                  label="PHONE"
                  value={member.phone}
                />

                <DetailItem
                  label="EMAIL"
                  value={member.email}
                />

                <DetailItem
                  label="DATE OF BIRTH"
                  value={formatDate(
                    member.date_of_birth,
                  )}
                />

                <DetailItem
                  label="GENDER"
                  value={member.gender}
                />

                <DetailItem
                  label="EMERGENCY CONTACT"
                  value={
                    member.emergency_contact
                  }
                />
              </div>
            </div>

            <div className="member-profile-workflow">
              <div>
                <p className="member-profile-eyebrow">
                  STAFF WORKFLOW
                </p>

                <h2>
                  WHAT HAPPENS NEXT?
                </h2>

                <p>
                  Use this member record as
                  the operational starting
                  point. Workout and diet
                  management now live directly
                  inside this profile.
                </p>
              </div>

              <div className="member-profile-workflow-list">
                {PROFILE_SECTIONS.slice(
                  1,
                ).map(
                  (
                    section,
                    index,
                  ) => (
                    <button
                      type="button"
                      key={
                        section.key
                      }
                      onClick={() =>
                        handleSectionChange(
                          section.key,
                        )
                      }
                    >
                      <span>
                        {String(
                          index + 1,
                        ).padStart(
                          2,
                          "0",
                        )}
                      </span>

                      <strong>
                        {
                          section.label
                        }
                      </strong>

                      <small>
                        {
                          section.description
                        }
                      </small>

                      <b>
                        →
                      </b>
                    </button>
                  ),
                )}
              </div>
            </div>
          </div>
        )}

        {activeSection ===
          "attendance" && (
          <AttendanceSection
            attendance={
              attendance
            }
            loading={
              attendanceLoading
            }
            error={
              attendanceError
            }
            saving={
              attendanceSaving
            }
            status={
              attendanceStatus
            }
            onStatusChange={
              setAttendanceStatus
            }
            onCheckIn={
              handleMemberCheckIn
            }
            onDelete={
              handleDeleteAttendance
            }
            stats={
              attendanceStats
            }
          />
        )}

        {activeSection ===
          "workout" && (
          <MemberWorkoutSection
            memberId={memberId}
          />
        )}

        {activeSection ===
          "diet" && (
          <MemberDietSection
            memberId={memberId}
          />
        )}

        {activeSection !==
          "overview" &&
          activeSection !==
            "attendance" &&
          activeSection !==
            "workout" &&
          activeSection !==
            "diet" && (
            <PlaceholderSection
              section={PROFILE_SECTIONS.find(
                (section) =>
                  section.key ===
                  activeSection,
              )}
            />
          )}
      </main>
    </section>
  );
}

function AttendanceSection({
  attendance,
  loading,
  error,
  saving,
  status,
  onStatusChange,
  onCheckIn,
  onDelete,
  stats,
}) {
  return (
    <section className="member-profile-attendance">
      <div className="member-profile-section-heading">
        <div>
          <p className="member-profile-eyebrow">
            MEMBER / ATTENDANCE
          </p>

          <h2>
            SHOW UP. STAY CONSISTENT.
          </h2>
        </div>

        <p>
          This is the attendance history
          for this member only.
        </p>
      </div>

      {error && (
        <div className="member-profile-attendance-error">
          <span>!</span>

          <p>
            {error}
          </p>
        </div>
      )}

      <div className="member-profile-attendance-summary">
        <article>
          <span>
            TOTAL RECORDS
          </span>

          <strong>
            {stats.total}
          </strong>
        </article>

        <article>
          <span>
            PRESENT
          </span>

          <strong>
            {stats.present}
          </strong>
        </article>

        <article>
          <span>
            LATEST CHECK-IN
          </span>

          <strong>
            {stats.latest
              ? formatTime(
                  stats.latest
                    .check_in_time,
                )
              : "—"}
          </strong>

          <small>
            {stats.latest
              ? formatDate(
                  stats.latest
                    .attendance_date,
                )
              : "No attendance yet"}
          </small>
        </article>
      </div>

      <div className="member-profile-attendance-action">
        <div>
          <p className="member-profile-eyebrow">
            QUICK ACTION
          </p>

          <h3>
            Record today's attendance.
          </h3>

          <p>
            This creates a new attendance
            record for this member.
          </p>
        </div>

        <div className="member-profile-attendance-action-controls">
          <select
            value={status}
            onChange={(event) =>
              onStatusChange(
                event.target.value,
              )
            }
            disabled={saving}
            aria-label="Attendance status"
          >
            <option value="present">
              Present
            </option>

            <option value="absent">
              Absent
            </option>
          </select>

          <button
            type="button"
            className="member-profile-attendance-checkin"
            onClick={onCheckIn}
            disabled={saving}
          >
            {saving
              ? "RECORDING..."
              : "RECORD ATTENDANCE →"}
          </button>
        </div>
      </div>

      <div className="member-profile-attendance-history">
        <div className="member-profile-section-heading compact">
          <div>
            <p className="member-profile-eyebrow">
              HISTORY
            </p>

            <h3>
              ATTENDANCE RECORDS.
            </h3>
          </div>

          <span>
            {attendance.length}{" "}
            RECORDS
          </span>
        </div>

        {loading ? (
          <div className="member-profile-attendance-loading">
            <span className="staff-loader" />

            <p>
              Loading attendance
              history...
            </p>
          </div>
        ) : attendance.length ===
          0 ? (
          <div className="member-profile-attendance-empty">
            <strong>
              NO ATTENDANCE YET.
            </strong>

            <p>
              Record this member's first
              attendance using the action
              above.
            </p>
          </div>
        ) : (
          <div className="member-profile-attendance-list">
            {attendance.map(
              (record) => (
                <article
                  className="member-profile-attendance-row"
                  key={String(
                    record?.id ||
                      record?._id ||
                      `${record?.member_id}-${record?.attendance_date}-${record?.check_in_time}`,
                  )}
                >
                  <div>
                    <span>
                      DATE
                    </span>

                    <strong>
                      {formatDate(
                        record?.attendance_date,
                      )}
                    </strong>
                  </div>

                  <div>
                    <span>
                      CHECK-IN
                    </span>

                    <strong>
                      {formatTime(
                        record?.check_in_time,
                      )}
                    </strong>
                  </div>

                  <span
                    className={
                      String(
                        record?.status ||
                          "",
                      ).toLowerCase() ===
                      "present"
                        ? "member-profile-attendance-status is-present"
                        : "member-profile-attendance-status is-absent"
                    }
                  >
                    {String(
                      record?.status ||
                        "present",
                    ).toUpperCase()}
                  </span>

                  {(record?.id ||
                    record?._id) && (
                    <button
                      type="button"
                      className="member-profile-attendance-delete"
                      onClick={() =>
                        onDelete(
                          record.id ||
                            record._id,
                        )
                      }
                    >
                      DELETE
                    </button>
                  )}
                </article>
              ),
            )}
          </div>
        )}
      </div>
    </section>
  );
}

function DetailItem({
  label,
  value,
}) {
  const displayValue =
    value === null ||
    value === undefined ||
    String(value).trim() === ""
      ? "NOT RECORDED"
      : value;

  return (
    <div className="member-profile-detail-item">
      <span>
        {label}
      </span>

      <strong>
        {displayValue}
      </strong>
    </div>
  );
}

function PlaceholderSection({
  section,
}) {
  if (!section) {
    return null;
  }

  return (
    <section className="member-profile-placeholder">
      <div className="member-profile-placeholder-index">
        /
      </div>

      <p className="member-profile-eyebrow">
        MEMBER / {section.label}
      </p>

      <h2>
        {section.label}
        <br />
        COMING NEXT.
      </h2>

      <p>
        This section is intentionally
        separated from the member overview.
        Its UI will connect to the existing{" "}
        {section.label.toLowerCase()}{" "}
        backend module without changing
        the member-profile workflow.
      </p>
    </section>
  );
}

export default MemberProfilePage;