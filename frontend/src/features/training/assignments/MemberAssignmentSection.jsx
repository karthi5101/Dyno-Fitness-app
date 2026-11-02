import { useState, useEffect } from "react";
import { apiRequest } from "../../../api/client";
import "./MemberAssignmentSection.css";

function MemberAssignmentSection({ memberId }) {
  const [assignment, setAssignment] = useState(null);
  const [assignments, setAssignments] = useState([]);
  const [history, setHistory] = useState([]);
  const [adherence, setAdherence] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [mode, setMode] = useState("rotation");
  const [weekdayMap, setWeekdayMap] = useState({});
  const [pointer, setPointer] = useState(0);
  const [startDate, setStartDate] = useState("");
  const [newProgramName, setNewProgramName] = useState("");
  const [newProgramGoal, setNewProgramGoal] = useState("");
  const [newProgramLevel, setNewProgramLevel] = useState("beginner");
  const [showAssignForm, setShowAssignForm] = useState(false);
  const [showEndConfirmation, setShowEndConfirmation] = useState(false);

  useEffect(() => {
    fetchAssignmentData();
    fetchAssignments();
    fetchHistory();
    fetchAdherence();
  }, [memberId]);

  const fetchAssignmentData = async () => {
    try {
      const assignment = await apiRequest(`/training/members/${memberId}/assignment/`);
      setAssignment(assignment.assignment);
    } catch (e) {
      setError(e.message);
    }
  };

  const fetchAssignments = async () => {
    try {
      const data = await apiRequest(
        `/training/members/${memberId}/assignments/`
      );
      setAssignments(data.assignments);
    } catch (e) {
      setError(e.message);
    }
  };

  const fetchHistory = async () => {
    try {
      const data = await apiRequest(
        `/training/members/${memberId}/history/`
      );
      setHistory(data.history);
    } catch (e) {
      setError(e.message);
    }
  };

  const fetchAdherence = async () => {
    try {
      const data = await apiRequest(
        `/training/me/adherence/staff/${memberId}/`
      );
      setAdherence(data);
    } catch (e) {
      setError(e.message);
    }
  };

  const handleAssign = async () => {
    try {
      await apiRequest(`/training/members/${memberId}/assignment/`, {
        method: "POST",
        body: JSON.stringify({
          program_id: null,
          mode,
          weekday_map: mode === "fixed_week" ? weekdayMap : {},
          pointer: mode === "rotation" ? pointer : 0,
          start_date: startDate || undefined,
        }),
      });
      setAssignment({
        mode,
        program_id: null,
        program_source_name: newProgramName || "",
        program_version: 1,
        program_copy: {
          name: newProgramName || "",
          goal: newProgramGoal || "",
          level: newProgramLevel || "beginner",
          days: [],
        },
        pointer: mode === "rotation" ? pointer : 0,
        weekday_map: mode === "fixed_week" ? weekdayMap : {},
        start_date: startDate,
        status: "active",
        revision: 1,
      });
      setShowAssignForm(false);
      fetchAssignmentData();
      fetchAssignments();
    } catch (e) {
      setError(e.message);
    }
  };

  const handleEdit = async (assignment) => {
    setMode(assignment.mode || "rotation");
    setWeekdayMap(assignment.weekday_map || {});
    setPointer(assignment.pointer || 0);
    setStartDate(assignment.start_date || "");
    setShowAssignForm(true);
  };

  const handleUpdate = async () => {
    try {
      await apiRequest(`/training/members/${memberId}/assignment/`, {
        method: "PATCH",
        body: JSON.stringify({
          mode: mode,
          weekday_map: mode === "fixed_week" ? weekdayMap : undefined,
          pointer: mode === "rotation" ? pointer : undefined,
          start_date: startDate || undefined,
          notes: "Edited via staff UI",
        }),
      });
      setShowAssignForm(false);
      fetchAssignmentData();
      fetchAssignments();
    } catch (e) {
      setError(e.message);
    }
  };

  const handleEnd = async () => {
    setShowEndConfirmation(true);
  };

  const handleEndConfirm = async () => {
    try {
      await apiRequest(`/training/members/${memberId}/assignment/end/`, {
        method: "POST",
      });
      setShowEndConfirmation(false);
      fetchAssignmentData();
      fetchAssignments();
    } catch (e) {
      setError(e.message);
    }
  };

  if (loading || error) {
    return (
      <div className="trn-assignment-error">
        <p>Error loading assignment data.</p>
      </div>
    );
  }

  return (
    <section className="trn-assignment-section">
      <h2>TRAINING ASSIGNMENT</h2>

      {assignment ? (
        <div className="assignment-details">
          <p><strong>Mode:</strong> {assignment.mode}</p>
          <p><strong>Program:</strong> {assignment.program_source_name}</p>
          <p><strong>Start Date:</strong> {assignment.start_date || "Not set"}</p>
          {assignment.mode === "fixed_week" && assignment.weekday_map
            ? <p>
                <strong>Weekday Map:</strong> {Object.entries(
                  assignment.weekday_map,
                )
                  .map(([key, value]) => `${key}: ${value}`)
                  .join(", ")}</p>
              : null}
          {assignment.mode === "rotation" && <p>
              <strong>Pointer:</strong> {assignment.pointer} /
              {(assignment.program_copy?.days?.length || 0)}
            </p>}
          <p><strong>Revision:</strong> {assignment.revision}</p>
          <p><strong>Status:</strong> {assignment.status}</p>
          {assignment.ended_at && (
            <p><strong>Ended:</strong> {assignment.ended_at}</p>
          )}

          <h3>Program Copy</h3>
          <p>Name: {assignment.program_copy?.name || "—"}</p>
          <p>Goal: {assignment.program_copy?.goal || "—"}</p>
          <p>Level: {assignment.program_copy?.level || "—"}</p>

          {assignment.mode === "rotation" && (
            <p>
              <strong>Pointer:</strong> {assignment.pointer} /{" "}
              {(assignment.program_copy?.days?.length || 0)}
            </p>
          )}

          {assignment.mode === "fixed_week" && assignment.weekday_map && (
            <p>
              <strong>Weekday Map:</strong> {" "}
              {Object.entries(assignment.weekday_map)
                .map(([key, value]) => `${key}: ${value}`)
                .join(", ")}
            </p>
          )}

          <button
            className="btn btn-secondary"
            onClick={() => setShowAssignForm(true)}
          >
            Edit Assignment
          </button>

          <button
            className="btn btn-danger"
            onClick={() => handleEnd()}
          >
            End Assignment
          </button>
        </div>
      ) : (
        <div className="assignment-empty">
          <p>No active assignment for this member.</p>
          <button
            className="btn btn-primary"
            onClick={() => setShowAssignForm(true)}
          >
            Assign New Program
          </button>
        </div>
      )}

      {showAssignForm && (
        <div className="assign-form-overlay">
          <h3>
            {assignment ? "Edit Assignment" : "Assign New Program"}
          </h3>
          <form
            onSubmit={e => {
              e.preventDefault();
              handleAssign();
            }}
          >
            <div className="form-group">
              <label>Mode</label>
              <select
                value={mode}
                onChange={e => setMode(e.target.value)}
              >
                <option value="rotation">Rotation</option>
                <option value="fixed_week">Fixed Week</option>
              </select>
            </div>

            {mode === "fixed_week" && (
              <div className="form-group">
                <label>Weekday Map</label>
                <select multiple
                  onChange={e => {
                    const map = {};
                    Array.from(e.target.options).forEach(opt => {
                      if (opt.selected) {
                        map[opt.dataset.day] = opt.value;
                      }
                    });
                    setWeekdayMap(map);
                  }}
                >
                  <option
                    data-day="mon"
                    value="mon"
                  >
                    Mon
                  </option>
                  <option data-day="tue" value="tue">
                    Tue
                  </option>
                  <option data-day="wed" value="wed">
                    Wed
                  </option>
                  <option data-day="thu" value="thu">
                    Thu
                  </option>
                  <option data-day="fri" value="fri">
                    Fri
                  </option>
                  <option data-day="sat" value="sat">
                    Sat
                  </option>
                  <option data-day="sun" value="sun">
                    Sun
                  </option>
                </select>
              </div>
            )}

            {mode === "rotation" && (
              <div className="form-group">
                <label>Pointer</label>
                <input
                  type="number"
                  value={pointer}
                  onChange={e => setPointer(parseInt(e.target.value) || 0)}
                  min={0}
                  max={
                    (assignments[0]?.program_copy?.days?.length || 1) - 1
                  }
                />
              </div>
            )}

            <div className="form-group">
              <label>Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label>Program Name</label>
              <input
                type="text"
                value={newProgramName}
                onChange={e => setNewProgramName(e.target.value)}
                placeholder="e.g. PPL 3-day"
              />
            </div>

            <div className="form-group">
              <label>Goal</label>
              <input
                type="text"
                value={newProgramGoal}
                onChange={e => setNewProgramGoal(e.target.value)}
                placeholder="e.g. muscle growth"
              />
            </div>

            <div className="form-group">
              <label>Level</label>
              <select
                value={newProgramLevel}
                onChange={e => setNewProgramLevel(e.target.value)}
              >
                <option value="beginner">Beginner</option>
                <option value="intermediate">Intermediate</option>
                <option value="advanced">Advanced</option>
              </select>
            </div>

            <div className="form-actions">
              {assignment ? (
                <button type="submit" name="update">
                  Update
                </button>
              ) : (
                <button type="submit" name="assign">
                  Assign
                </button>
              )}
              <button type="button" onClick={e => {
                e.preventDefault();
                setShowAssignForm(false);
              }}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {showEndConfirmation && (
        <div className="confirm-overlay">
          <p>Are you sure you want to end this assignment?</p>
          <p>
            This will mark all in-progress sessions as abandoned.
          </p>
          <button
            className="btn-danger"
            onClick={handleEndConfirm}
          >
            Yes, End Assignment
          </button>
          <button
            className="btn-secondary"
            onClick={() => setShowEndConfirmation(false)}
          >
            Cancel
          </button>
        </div>
      )}

      <hr />

      <h3>Assignments History</h3>
      {assignments.length > 0 ? (
        <ul>
          {assignments.map((a, i) => (
            <li key={i}>
              <strong>{a.program_source_name || "Unknown"}:</strong>
              {a.status === "active" ? " (active)" : ""}
              {a.ended_at && ` ended ${a.ended_at}`}
            </li>
          ))}
        </ul>
      ) : (
        <p>No assignments found.</p>
      )}

      <h3>Adherence This Week</h3>
      {adherence ? (
        <div>
          <p>Completed: {adherence.completed_this_week}</p>
          <p>Expected: {adherence.expected_this_week}</p>
          <p>Adherence: {adherence.adherence_pct}%</p>
        </div>
      ) : (
        <p>Loading adherence...</p>
      )}

      <h3>Assignment History Records</h3>
      {history.length > 0 ? (
        <ul>
          {history.map((h, i) => (
            <li key={i}>
              <strong>{h.change_type}:</strong> {h.notes || "no notes"} |
              {h.changed_by}
            </li>
          ))}
        </ul>
      ) : (
        <p>No history records.</p>
      )}
    </section>
  );
}

export default MemberAssignmentSection;