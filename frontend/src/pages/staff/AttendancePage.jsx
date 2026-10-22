import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import {
  createAttendance,
  deleteAttendance,
  getMembers,
  getTodayAttendance,
} from "../../api/client";

import "./AttendancePage.css";

function getLocalDate() {
  const date = new Date();

  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function formatTime(value) {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDate(value) {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleDateString([], {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function getAttendanceId(record) {
  return (
    record?.id ||
    record?._id ||
    record?.attendance_id
  );
}

function getMemberName(member, record) {
  return (
    member?.name ||
    record?.member_name ||
    record?.member_id ||
    "Unknown Member"
  );
}

function isPresentRecord(record) {
  return (
    String(record?.status || "").toLowerCase() ===
    "present"
  );
}

function AttendancePage() {
  const navigate = useNavigate();

  const [attendance, setAttendance] = useState([]);
  const [members, setMembers] = useState([]);

  const [search, setSearch] = useState("");
  const [selectedMember, setSelectedMember] =
    useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState("");

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function loadData() {
    try {
      setLoading(true);
      setError("");

      const [
        attendanceData,
        membersData,
      ] = await Promise.all([
        getTodayAttendance(),
        getMembers(),
      ]);

      setAttendance(
        Array.isArray(attendanceData)
          ? attendanceData
          : [],
      );

      setMembers(
        Array.isArray(membersData)
          ? membersData
          : [],
      );
    } catch (err) {
      setError(
        err?.message ||
          "Unable to load attendance.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (!error && !success) {
      return undefined;
    }

    const timer = window.setTimeout(() => {
      setError("");
      setSuccess("");
    }, 5000);

    return () => {
      window.clearTimeout(timer);
    };
  }, [error, success]);

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

  const activeMembers = useMemo(
    () =>
      members.filter(
        (member) =>
          String(member?.status || "").toLowerCase() ===
          "active",
      ),
    [members],
  );

  const filteredAttendance = useMemo(() => {
    const query = search
      .trim()
      .toLowerCase();

    if (!query) {
      return attendance;
    }

    return attendance.filter((record) => {
      const member = memberMap.get(
        record.member_id,
      );

      const memberName = getMemberName(
        member,
        record,
      );

      return [
        record?.member_id,
        memberName,
        member?.phone,
        member?.email,
        record?.status,
      ]
        .filter(Boolean)
        .some((value) =>
          String(value)
            .toLowerCase()
            .includes(query),
        );
    });
  }, [
    attendance,
    memberMap,
    search,
  ]);

  const presentCount = useMemo(
    () =>
      attendance.filter(
        isPresentRecord,
      ).length,
    [attendance],
  );

  const totalActiveMembers =
    activeMembers.length;

  const absentCount = Math.max(
    totalActiveMembers - presentCount,
    0,
  );

  async function handleCheckIn(event) {
    event.preventDefault();

    if (!selectedMember) {
      setError(
        "Select a member before checking in.",
      );
      return;
    }

    const alreadyCheckedIn =
      attendance.some(
        (record) =>
          record?.member_id ===
            selectedMember &&
          isPresentRecord(record),
      );

    if (alreadyCheckedIn) {
      setError(
        "This member is already marked present today.",
      );
      return;
    }

    try {
      setSaving(true);
      setError("");
      setSuccess("");

      const now = new Date();

      const record =
        await createAttendance({
          member_id: selectedMember,
          attendance_date: getLocalDate(),
          status: "present",
          check_in_time:
            now.toISOString(),
        });

      setAttendance((current) => [
        record,
        ...current,
      ]);

      setSelectedMember("");

      const member =
        memberMap.get(selectedMember);

      setSuccess(
        `${
          member?.name ||
          selectedMember
        } checked in successfully.`,
      );
    } catch (err) {
      setError(
        err?.message ||
          "Unable to mark attendance.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(
    attendanceId,
  ) {
    if (!attendanceId) {
      setError(
        "Attendance record ID is missing.",
      );
      return;
    }

    const confirmed = window.confirm(
      "Delete this attendance record?",
    );

    if (!confirmed) {
      return;
    }

    try {
      setDeletingId(
        String(attendanceId),
      );
      setError("");
      setSuccess("");

      await deleteAttendance(
        attendanceId,
      );

      setAttendance((current) =>
        current.filter(
          (record) =>
            String(
              getAttendanceId(record),
            ) !==
            String(attendanceId),
        ),
      );

      setSuccess(
        "Attendance record deleted.",
      );
    } catch (err) {
      setError(
        err?.message ||
          "Unable to delete attendance.",
      );
    } finally {
      setDeletingId("");
    }
  }

  function handleMemberNavigation(
    memberId,
  ) {
    if (!memberId) {
      return;
    }

    navigate(
      `/staff/members/${memberId}`,
    );
  }

  if (loading) {
    return (
      <section className="staff-page attendance-page">
        <div className="staff-state">
          <span className="staff-loader" />

          <p>
            Loading attendance...
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="staff-page attendance-page">
      <header className="staff-page-header">
        <div>
          <p className="staff-eyebrow">
            STAFF — ATTENDANCE
          </p>

          <h1>
            SHOW UP.
          </h1>

          <p>
            Manage today&apos;s gym attendance
            and check-ins.
          </p>
        </div>

        <div className="attendance-header-actions">
          <Link
            className="staff-button staff-button-dark"
            to="/staff/gym-qr"
          >
            DISPLAY GYM QR →
          </Link>

          <div className="staff-date-block">
            <span>TODAY</span>

            <strong>
              {new Date().toLocaleDateString(
                [],
                {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                },
              )}
            </strong>
          </div>
        </div>
      </header>

      {error && (
        <div className="staff-message staff-message-error">
          {error}
        </div>
      )}

      {success && (
        <div className="staff-message staff-message-success">
          {success}
        </div>
      )}

      <div className="attendance-hero">
        <div>
          <span>PRESENT TODAY</span>

          <strong>
            {presentCount}
          </strong>

          <p>
            recorded check-ins
          </p>
        </div>

        <div className="attendance-hero-mark">
          ATTENDANCE
        </div>
      </div>

      <div className="attendance-actions">
        <form
          className="attendance-checkin-card"
          onSubmit={handleCheckIn}
        >
          <div>
            <p className="staff-eyebrow">
              QUICK CHECK-IN
            </p>

            <h2>
              Mark attendance.
            </h2>
          </div>

          <div className="attendance-form-row">
            <select
              value={selectedMember}
              onChange={(event) => {
                setSelectedMember(
                  event.target.value,
                );
                setError("");
                setSuccess("");
              }}
              disabled={
                saving ||
                activeMembers.length === 0
              }
            >
              <option value="">
                {activeMembers.length ===
                0
                  ? "No active members"
                  : "Select member"}
              </option>

              {activeMembers.map(
                (member) => {
                  const alreadyPresent =
                    attendance.some(
                      (record) =>
                        record?.member_id ===
                          member.member_id &&
                        isPresentRecord(
                          record,
                        ),
                    );

                  return (
                    <option
                      key={
                        member.member_id
                      }
                      value={
                        member.member_id
                      }
                      disabled={
                        alreadyPresent
                      }
                    >
                      {member.name} —{" "}
                      {member.member_id}
                      {alreadyPresent
                        ? " · PRESENT"
                        : ""}
                    </option>
                  );
                },
              )}
            </select>

            <button
              type="submit"
              disabled={
                saving ||
                !selectedMember
              }
              className="staff-button staff-button-dark"
            >
              {saving
                ? "SAVING..."
                : "CHECK IN"}
            </button>
          </div>
        </form>

        <div className="attendance-search-card">
          <p className="staff-eyebrow">
            SEARCH
          </p>

          <input
            type="search"
            placeholder="Name, ID, phone..."
            value={search}
            onChange={(event) =>
              setSearch(
                event.target.value,
              )
            }
          />
        </div>
      </div>

      <div className="attendance-summary-strip">
        <div>
          <span>PRESENT</span>
          <strong>
            {presentCount}
          </strong>
        </div>

        <div>
          <span>ACTIVE MEMBERS</span>
          <strong>
            {totalActiveMembers}
          </strong>
        </div>

        <div>
          <span>NOT CHECKED IN</span>
          <strong>
            {absentCount}
          </strong>
        </div>

        <div>
          <span>SHOWING</span>
          <strong>
            {filteredAttendance.length}
          </strong>
        </div>
      </div>

      <section className="staff-section">
        <div className="staff-section-header">
          <div>
            <p className="staff-eyebrow">
              RECORDS
            </p>

            <h2>
              Today&apos;s attendance.
            </h2>
          </div>

          <span>
            {filteredAttendance.length}{" "}
            RECORD
            {filteredAttendance.length ===
            1
              ? ""
              : "S"}
          </span>
        </div>

        {filteredAttendance.length ===
        0 ? (
          <div className="staff-empty">
            <strong>
              {search.trim()
                ? "No matching attendance records."
                : "No attendance records."}
            </strong>

            <p>
              {search.trim()
                ? "Try a different member name, ID, or phone number."
                : "Check in a member to see today&apos;s activity here."}
            </p>

            {search.trim() && (
              <button
                type="button"
                className="staff-button staff-button-light"
                onClick={() =>
                  setSearch("")
                }
              >
                CLEAR SEARCH
              </button>
            )}
          </div>
        ) : (
          <div className="attendance-list">
            {filteredAttendance.map(
              (record) => {
                const member =
                  memberMap.get(
                    record?.member_id,
                  );

                const attendanceId =
                  getAttendanceId(
                    record,
                  );

                const memberName =
                  getMemberName(
                    member,
                    record,
                  );

                const isDeleting =
                  String(
                    deletingId,
                  ) ===
                  String(
                    attendanceId,
                  );

                return (
                  <article
                    className="attendance-row"
                    key={
                      String(
                        attendanceId ||
                          `${record?.member_id}-${record?.attendance_date}-${record?.check_in_time}`,
                      )
                    }
                  >
                    <button
                      type="button"
                      className="attendance-member"
                      onClick={() =>
                        handleMemberNavigation(
                          record?.member_id,
                        )
                      }
                      disabled={
                        !record?.member_id
                      }
                    >
                      <span className="attendance-avatar">
                        {memberName
                          ?.charAt(0)
                          ?.toUpperCase() ||
                          "M"}
                      </span>

                      <span>
                        <strong>
                          {memberName}
                        </strong>

                        <small>
                          {
                            record?.member_id
                          }
                        </small>
                      </span>
                    </button>

                    <div className="attendance-meta">
                      <span>
                        {formatDate(
                          record?.attendance_date,
                        )}
                      </span>

                      <strong>
                        {formatTime(
                          record?.check_in_time,
                        )}
                      </strong>
                    </div>

                    <span className="attendance-status">
                      {String(
                        record?.status ||
                          "present",
                      ).toUpperCase()}
                    </span>

                    <button
                      type="button"
                      className="attendance-delete"
                      disabled={
                        isDeleting
                      }
                      onClick={() =>
                        handleDelete(
                          attendanceId,
                        )
                      }
                    >
                      {isDeleting
                        ? "DELETING..."
                        : "DELETE"}
                    </button>
                  </article>
                );
              },
            )}
          </div>
        )}
      </section>
    </section>
  );
}

export default AttendancePage;