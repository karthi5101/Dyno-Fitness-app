import { useEffect, useMemo, useState } from "react";

import { getAttendance, getMembers } from "../api/client";
import "./AttendancePage.css";

function formatDate(value) {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function getInitials(name = "") {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function getAttendanceMemberId(record) {
  return (
    record?.member_id ||
    record?.member?.member_id ||
    record?.memberId ||
    ""
  );
}

function getAttendanceDate(record) {
  return (
    record?.attendance_date ||
    record?.date ||
    record?.created_at ||
    record?.createdAt ||
    null
  );
}

function getMemberName(record, membersById) {
  const memberId = getAttendanceMemberId(record);

  return (
    record?.member_name ||
    record?.member?.name ||
    membersById.get(memberId)?.name ||
    memberId ||
    "Unknown member"
  );
}

function AttendancePage() {
  const [attendance, setAttendance] = useState([]);
  const [members, setMembers] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadAttendance() {
      try {
        setLoading(true);
        setError("");

        const [attendanceData, membersData] = await Promise.all([
          getAttendance(),
          getMembers(),
        ]);

        if (!cancelled) {
          setAttendance(Array.isArray(attendanceData) ? attendanceData : []);
          setMembers(Array.isArray(membersData) ? membersData : []);
        }
      } catch (requestError) {
        if (!cancelled) {
          setError(
            requestError?.message ||
              "Unable to load attendance data.",
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadAttendance();

    return () => {
      cancelled = true;
    };
  }, []);

  const membersById = useMemo(
    () =>
      new Map(
        members.map((member) => [member.member_id, member]),
      ),
    [members],
  );

  const todayKey = new Date().toISOString().slice(0, 10);

  const todayAttendance = useMemo(
    () =>
      attendance.filter((record) => {
        const value = getAttendanceDate(record);

        if (!value) {
          return false;
        }

        return new Date(value).toISOString().slice(0, 10) === todayKey;
      }),
    [attendance, todayKey],
  );

  const activeMembers = useMemo(
    () =>
      members.filter(
        (member) => member.status?.toLowerCase() === "active",
      ),
    [members],
  );

  const attendanceRate =
    activeMembers.length > 0
      ? Math.round(
          (todayAttendance.length / activeMembers.length) * 100,
        )
      : 0;

  const filteredAttendance = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) {
      return attendance;
    }

    return attendance.filter((record) => {
      const memberId = getAttendanceMemberId(record);
      const memberName = getMemberName(record, membersById);

      return (
        memberId.toLowerCase().includes(query) ||
        memberName.toLowerCase().includes(query)
      );
    });
  }, [attendance, membersById, search]);

  const recentAttendance = filteredAttendance.slice(0, 12);

  return (
    <section className="attendance-page">
      <header className="attendance-page-header">
        <div className="attendance-heading-block">
          <p className="attendance-eyebrow">ATTENDANCE / DAILY RECORD</p>

          <h1>
            SHOW
            <br />
            <span>UP.</span>
          </h1>

          <p>
            Every session counts. Track who showed up,
            when they came in, and how consistently they train.
          </p>
        </div>

        <div className="attendance-header-meta">
          <span>TODAY</span>
          <strong>
            {new Date().toLocaleDateString("en-IN", {
              day: "2-digit",
              month: "short",
              year: "numeric",
            })}
          </strong>
          <span>{activeMembers.length} ACTIVE MEMBERS</span>
        </div>
      </header>

      {error ? (
        <div className="attendance-alert">{error}</div>
      ) : null}

      <section className="attendance-hero">
        <div className="attendance-hero-copy">
          <p>TODAY AT DYNO</p>

          <h2>
            SHOW
            <br />
            <span>UP.</span>
          </h2>

          <small>
            Attendance is recorded against each member and
            preserved as part of their training history.
          </small>
        </div>

        <div className="attendance-hero-number">
          <span>PRESENT TODAY</span>
          <strong>
            {String(todayAttendance.length).padStart(2, "0")}
          </strong>
          <small>
            OF {String(activeMembers.length).padStart(2, "0")} ACTIVE
          </small>
        </div>
      </section>

      <section className="attendance-summary" aria-label="Attendance summary">
        <article>
          <span>PRESENT TODAY</span>
          <strong>
            {String(todayAttendance.length).padStart(2, "0")}
          </strong>
          <small>attendance records today</small>
        </article>

        <article>
          <span>ACTIVE MEMBERS</span>
          <strong>
            {String(activeMembers.length).padStart(2, "0")}
          </strong>
          <small>members currently active</small>
        </article>

        <article className="attendance-summary-accent">
          <span>TODAY'S RATE</span>
          <strong>{attendanceRate}%</strong>
          <small>active members present</small>
        </article>

        <article>
          <span>TOTAL RECORDS</span>
          <strong>{String(attendance.length).padStart(2, "0")}</strong>
          <small>attendance records stored</small>
        </article>
      </section>

      <section className="attendance-content-grid">
        <div className="attendance-history">
          <div className="attendance-section-heading">
            <div>
              <p className="attendance-eyebrow">RECORDS</p>
              <h2>ATTENDANCE HISTORY</h2>
            </div>

            <span>{filteredAttendance.length} RECORDS</span>
          </div>

          <div className="attendance-search">
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search member or ID"
              aria-label="Search attendance"
            />
          </div>

          <div className="attendance-record-list">
            {loading ? (
              <div className="attendance-state">
                <span />
                <p>LOADING ATTENDANCE</p>
              </div>
            ) : recentAttendance.length > 0 ? (
              recentAttendance.map((record, index) => {
                const memberId = getAttendanceMemberId(record);
                const memberName = getMemberName(
                  record,
                  membersById,
                );

                return (
                  <article
                    className="attendance-record"
                    key={
                      record?.attendance_id ||
                      record?.id ||
                      `${memberId}-${getAttendanceDate(record)}-${index}`
                    }
                  >
                    <div className="attendance-record-index">
                      {String(index + 1).padStart(2, "0")}
                    </div>

                    <div className="attendance-record-avatar">
                      {getInitials(memberName)}
                    </div>

                    <div className="attendance-record-main">
                      <strong>{memberName}</strong>
                      <span>{memberId || "MEMBER"}</span>
                    </div>

                    <div className="attendance-record-date">
                      <span>DATE</span>
                      <strong>
                        {formatDate(getAttendanceDate(record))}
                      </strong>
                    </div>

                    <div className="attendance-record-status">
                      <span />
                      PRESENT
                    </div>
                  </article>
                );
              })
            ) : (
              <div className="attendance-empty">
                <p>NO RECORDS</p>
                <h3>
                  KEEP
                  <br />
                  <span>SHOWING UP.</span>
                </h3>
                <small>
                  Attendance records will appear here once members
                  check in at the gym.
                </small>
              </div>
            )}
          </div>
        </div>

        <aside className="attendance-side">
          <div className="attendance-consistency-card">
            <p className="attendance-eyebrow">CONSISTENCY</p>

            <h2>
              KEEP
              <br />
              <span>GOING.</span>
            </h2>

            <div className="attendance-week">
              {["M", "T", "W", "T", "F", "S", "S"].map(
                (day, index) => (
                  <div key={`${day}-${index}`}>
                    <span>{day}</span>
                    <i
                      className={
                        index < 3
                          ? "attendance-day attendance-day-active"
                          : "attendance-day"
                      }
                    />
                  </div>
                ),
              )}
            </div>

            <small>
              Your attendance pattern becomes meaningful over
              time. Keep building the habit.
            </small>
          </div>

          <div className="attendance-side-card">
            <p className="attendance-eyebrow">QUICK VIEW</p>

            <h2>MEMBERS</h2>

            <div className="attendance-member-list">
              {activeMembers.slice(0, 5).map((member) => (
                <div
                  className="attendance-member"
                  key={member.member_id}
                >
                  <div className="attendance-record-avatar">
                    {getInitials(member.name)}
                  </div>

                  <div>
                    <strong>{member.name}</strong>
                    <span>{member.member_id}</span>
                  </div>
                </div>
              ))}

              {activeMembers.length === 0 ? (
                <p className="attendance-side-empty">
                  No active members.
                </p>
              ) : null}
            </div>
          </div>
        </aside>
      </section>
    </section>
  );
}

export default AttendancePage;
