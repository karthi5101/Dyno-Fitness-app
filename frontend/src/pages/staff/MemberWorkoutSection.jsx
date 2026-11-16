import { useState, useEffect } from "react";
import { apiRequest } from "../../api/client";
import "./MemberWorkoutSection.css";

function MemberWorkoutSection({ memberId }) {
  const [assignment, setAssignment] = useState(null);
  const [assignments, setAssignments] = useState([]);
  const [history, setHistory] = useState([]);
  const [adherence, setAdherence] = useState(null);
  const [availablePrograms, setAvailablePrograms] = useState([]);
  const [selectedProgramId, setSelectedProgramId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [formError, setFormError] = useState(null);
  const [mode, setMode] = useState("rotation");
  const [weekdayMap, setWeekdayMap] = useState({});
  const [pointer, setPointer] = useState(0);
  const [startDate, setStartDate] = useState("");
  const [showAssignForm, setShowAssignForm] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [showEndConfirmation, setShowEndConfirmation] = useState(false);

  useEffect(() => {
    loadAllData();
  }, [memberId]);

  const loadAllData = async () => {
    setLoading(true);
    setError(null);
    try {
      await Promise.all([
        fetchAssignmentData(),
        fetchHistory(),
        fetchAdherence(),
        fetchPrograms(),
      ]);
    } catch (e) {
      setError(e.message || "Failed to load assignment data.");
    } finally {
      setLoading(false);
    }
  };

  const fetchAssignmentData = async () => {
    try {
      const data = await apiRequest(`/training/members/${memberId}/assignment/`);
      setAssignment(data.assignment || null);
      if (Array.isArray(data.assignments)) {
        setAssignments(data.assignments);
      }
    } catch (e) {
      // 404 might mean no assignment
      if (!e.message?.includes("not found")) {
        console.warn("fetchAssignmentData:", e);
      }
    }
  };

  const fetchHistory = async () => {
    try {
      const data = await apiRequest(`/training/members/${memberId}/history/`);
      if (Array.isArray(data.history)) {
        setHistory(data.history);
      }
      if (Array.isArray(data.assignments)) {
        setAssignments(data.assignments);
      }
    } catch (e) {
      console.warn("fetchHistory:", e);
    }
  };

  const fetchAdherence = async () => {
    try {
      const data = await apiRequest(`/training/members/${memberId}/adherence/`);
      setAdherence(data);
    } catch (e) {
      console.warn("fetchAdherence:", e);
    }
  };

  const fetchPrograms = async () => {
    try {
      const data = await apiRequest("/training/programs/");
      if (data && Array.isArray(data.results)) {
        setAvailablePrograms(data.results.filter((p) => !p.archived));
      }
    } catch (e) {
      console.warn("fetchPrograms:", e);
    }
  };

  const openAssignModal = () => {
    setIsEditing(false);
    setSelectedProgramId(availablePrograms[0]?.id || "");
    setMode("rotation");
    setPointer(0);
    setWeekdayMap({});
    setStartDate(new Date().toISOString().split("T")[0]);
    setFormError(null);
    setShowAssignForm(true);
  };

  const openEditModal = () => {
    if (!assignment) return;
    setIsEditing(true);
    setMode(assignment.mode || "rotation");
    setPointer(assignment.pointer || 0);
    setWeekdayMap(assignment.weekday_map || {});
    setStartDate(assignment.start_date || "");
    setFormError(null);
    setShowAssignForm(true);
  };

  const handleAssign = async (e) => {
    e.preventDefault();
    setFormError(null);

    if (!selectedProgramId) {
      setFormError("Please select a training program.");
      return;
    }

    try {
      await apiRequest(`/training/members/${memberId}/assignment/`, {
        method: "POST",
        body: JSON.stringify({
          program_id: selectedProgramId,
          mode,
          weekday_map: mode === "fixed_week" ? weekdayMap : {},
          pointer: mode === "rotation" ? Number(pointer) || 0 : 0,
          start_date: startDate || undefined,
        }),
      });
      setShowAssignForm(false);
      await loadAllData();
    } catch (err) {
      setFormError(err.message || "Failed to create assignment.");
    }
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    setFormError(null);

    try {
      await apiRequest(`/training/members/${memberId}/assignment/`, {
        method: "PATCH",
        body: JSON.stringify({
          mode,
          weekday_map: mode === "fixed_week" ? weekdayMap : undefined,
          pointer: mode === "rotation" ? Number(pointer) || 0 : undefined,
          start_date: startDate || undefined,
          notes: "Edited via staff UI",
        }),
      });
      setShowAssignForm(false);
      await loadAllData();
    } catch (err) {
      setFormError(err.message || "Failed to update assignment.");
    }
  };

  const handleEndConfirm = async () => {
    try {
      await apiRequest(`/training/members/${memberId}/assignment/end/`, {
        method: "POST",
      });
      setShowEndConfirmation(false);
      await loadAllData();
    } catch (e) {
      setError(e.message || "Failed to end assignment.");
    }
  };

  if (loading) {
    return (
      <section className="trn-assignment-section">
        <p>Loading assignment data...</p>
      </section>
    );
  }

  const selectedProgram = availablePrograms.find((p) => p.id === selectedProgramId);
  const availableDays = isEditing
    ? assignment?.program_copy?.days || []
    : selectedProgram?.days || [];

  return (
    <section className="trn-assignment-section">
      <h2>TRAINING ASSIGNMENT</h2>

      {error && (
        <div className="trn-assignment-error">
          <p>{error}</p>
        </div>
      )}

      {assignment ? (
        <div className="assignment-details">
          <p><strong>Mode:</strong> {assignment.mode}</p>
          <p><strong>Program:</strong> {assignment.program_source_name || assignment.program_copy?.name}</p>
          <p><strong>Start Date:</strong> {assignment.start_date || "Not set"}</p>
          {assignment.mode === "fixed_week" && assignment.weekday_map && (
            <p>
              <strong>Weekday Map:</strong>{" "}
              {Object.entries(assignment.weekday_map)
                .map(([key, value]) => `${key}: ${value}`)
                .join(", ")}
            </p>
          )}
          {assignment.mode === "rotation" && (
            <p>
              <strong>Pointer:</strong> {assignment.pointer} /{" "}
              {assignment.program_copy?.days?.length || 0}
            </p>
          )}
          <p><strong>Revision:</strong> {assignment.revision}</p>
          <p><strong>Status:</strong> {assignment.status}</p>
          {assignment.ended_at && (
            <p><strong>Ended:</strong> {assignment.ended_at}</p>
          )}

          <h3>Program Details</h3>
          <p>Name: {assignment.program_copy?.name || "—"}</p>
          <p>Goal: {assignment.program_copy?.goal || "—"}</p>
          <p>Level: {assignment.program_copy?.level || "—"}</p>
          <p>Days: {assignment.program_copy?.days?.length || 0}</p>

          <div style={{ marginTop: "16px", display: "flex", gap: "12px" }}>
            <button
              className="btn btn-secondary"
              onClick={openEditModal}
            >
              Edit Assignment
            </button>
            <button
              className="btn btn-danger"
              onClick={() => setShowEndConfirmation(true)}
            >
              End Assignment
            </button>
          </div>
        </div>
      ) : (
        <div className="assignment-empty">
          <p>No active assignment for this member.</p>
          <button
            className="btn btn-primary"
            onClick={openAssignModal}
          >
            Assign Program
          </button>
        </div>
      )}

      {showAssignForm && (
        <div className="assign-form-overlay">
          <h3>
            {isEditing ? "Edit Assignment" : "Assign Program"}
          </h3>
          {formError && <p className="trn-error">{formError}</p>}
          <form onSubmit={isEditing ? handleUpdate : handleAssign}>
            {!isEditing && (
              <div className="form-group">
                <label>Program</label>
                <select
                  value={selectedProgramId}
                  onChange={(e) => setSelectedProgramId(e.target.value)}
                  required
                >
                  <option value="">-- Choose a Program --</option>
                  {availablePrograms.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.days?.length || 0} days)
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="form-group">
              <label>Mode</label>
              <select
                value={mode}
                onChange={(e) => setMode(e.target.value)}
              >
                <option value="rotation">Rotation</option>
                <option value="fixed_week">Fixed Week</option>
              </select>
            </div>

            {mode === "fixed_week" && (
              <div className="form-group">
                <label>Weekday Schedule</label>
                {["mon", "tue", "wed", "thu", "fri", "sat", "sun"].map((day) => (
                  <div key={day} style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                    <span style={{ width: "45px", textTransform: "uppercase" }}>{day}</span>
                    <select
                      value={weekdayMap[day] || ""}
                      onChange={(e) =>
                        setWeekdayMap((prev) => ({
                          ...prev,
                          [day]: e.target.value || undefined,
                        }))
                      }
                    >
                      <option value="">Rest Day</option>
                      {availableDays.map((d) => (
                        <option key={d.day_key} value={d.day_key}>
                          {d.label || d.day_key}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            )}

            {mode === "rotation" && (
              <div className="form-group">
                <label>Current Pointer (Day Index)</label>
                <input
                  type="number"
                  value={pointer}
                  onChange={(e) => setPointer(parseInt(e.target.value, 10) || 0)}
                  min={0}
                  max={Math.max(0, (availableDays.length || 1) - 1)}
                />
              </div>
            )}

            <div className="form-group">
              <label>Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>

            <div className="form-actions" style={{ display: "flex", gap: "12px", marginTop: "16px" }}>
              <button type="submit" className="btn btn-primary">
                {isEditing ? "Save Changes" : "Assign Program"}
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowAssignForm(false)}
              >
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
            This will end the active assignment and archive current progress.
          </p>
          <div style={{ display: "flex", gap: "12px", marginTop: "12px" }}>
            <button
              className="btn btn-danger"
              onClick={handleEndConfirm}
            >
              Yes, End Assignment
            </button>
            <button
              className="btn btn-secondary"
              onClick={() => setShowEndConfirmation(false)}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <hr style={{ margin: "24px 0" }} />

      <h3>Adherence</h3>
      {adherence ? (
        <div className="adherence-card">
          <p>Completed This Week: {adherence.completed_this_week ?? adherence.completed ?? 0}</p>
          <p>Expected This Week: {adherence.expected_this_week ?? adherence.expected ?? 0}</p>
          <p>Adherence: {adherence.adherence_pct ?? adherence.rate ?? 0}%</p>
        </div>
      ) : (
        <p>No adherence data recorded yet.</p>
      )}

      <hr style={{ margin: "24px 0" }} />

      <h3>Assignment History Records</h3>
      {history.length > 0 ? (
        <ul>
          {history.map((h, i) => (
            <li key={h.id || i}>
              <strong>{h.change_type}:</strong> {h.notes || "no notes"} (by {h.changed_by})
            </li>
          ))}
        </ul>
      ) : (
        <p>No history records.</p>
      )}
    </section>
  );
}

export default MemberWorkoutSection;
