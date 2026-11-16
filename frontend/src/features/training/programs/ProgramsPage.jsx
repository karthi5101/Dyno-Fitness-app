import { useState } from "react";
import { apiRequest } from "../../../api/client";
import "./ProgramsPage.css";

function ProgramsPage({ onSave, onClose }) {
  const [program, setProgram] = useState({
    name: "",
    name_lc: "",
    goal: "",
    level: "",
    days: [],
  });

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const updateProgramField = (field, value) =>
    setProgram((p) => ({ ...p, [field]: value }));

  const addDay = () => {
    const newDay = {
      day_key: `day_${program.days.length + 1}`,
      label: `Day ${program.days.length + 1}`,
      order: program.days.length + 1,
      blocks: [],
    };
    setProgram((p) => ({ ...p, days: [...p.days, newDay] }));
  };

  const saveProgram = async () => {
    setError("");
    setLoading(true);
    try {
      await apiRequest("/training/programs/", {
        method: "POST",
        body: JSON.stringify(program),
      });
      if (onSave) onSave(program);
      if (onClose) onClose();
    } catch (err) {
      setError(err?.message || "Unable to save program.");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div>Loading programs...</div>;
  }

  return (
    <section className="trn-programs-page">
      <header className="trn-programs-header">
        <h1>Program Builder</h1>
        <p className="trn-programs-subtitle">
          Build strength programs with days, exercises, sets, and notes.
        </p>
      </header>

      <div className="trn-programs-toolbar">
        <label>
          <span>NAME</span>
          <input
            value={program.name}
            onChange={(e) => {
              const lc = e.target.value
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, "-")
                .replace(/^-+|-+$/g, "");
              updateProgramField("name", e.target.value);
              updateProgramField("name_lc", lc);
            }}
            placeholder="Program name"
            required
          />
        </label>

        <label>
          <span>GOAL</span>
          <select value={program.goal} onChange={(e) => updateProgramField("goal", e.target.value)}>
            <option value="">Select goal</option>
            <option value="muscle growth">Muscle growth</option>
            <option value="strength">Strength</option>
            <option value="endurance">Endurance</option>
            <option value="weight loss">Weight loss</option>
          </select>
        </label>

        <label>
          <span>LEVEL</span>
          <select value={program.level} onChange={(e) => updateProgramField("level", e.target.value)}>
            <option value="">Select level</option>
            <option value="beginner">Beginner</option>
            <option value="intermediate">Intermediate</option>
            <option value="expert">Expert</option>
          </select>
        </label>

        <button
          type="button"
          className="trn-primary-button"
          onClick={addDay}
          disabled={program.name.trim() === ""}
        >
          ADD DAY
        </button>
      </div>

      <div className="trn-programs-grid">
        <div className="trn-programs-main">
          <div className="trn-programs-main-header">
            <h2>PROGRAM</h2>
            <button
              type="button"
              className="trn-secondary-button"
              onClick={onClose}
            >
              Close
            </button>
          </div>

          {error && (
            <p className="trn-error" role="alert">{error}</p>
          )}

          {program.name.trim() === "" && (
            <p className="trn-empty-state">
              Enter a program name to begin building.
            </p>
          )}

          {program.name.trim() !== "" && (
            <div className="trn-days-editor">
              {program.days.map((day, di) => (
                <div
                  key={day.day_key}
                  className="trn-day-editor"
                >
                  <div className="trn-day-header">
                    <span className="trn-day-label">{day.label}</span>
                    <button
                      type="button"
                      className="trn-day-delete-btn"
                      onClick={() =>
                        setProgram(
                          (p) => p.days.filter((_, idx) => idx !== di)
                        )
                      }
                    >
                      ❌
                    </button>
                  </div>

                  <div className="trn-day-blocks">
                    {day.blocks.map((block, bi) => (
                      <div
                        key={block.block_id}
                        className="trn-block-editor"
                      >
                        <div className="trn-block-header">
                          <span className="trn-block-id">
                            {block.block_id || "New Block"}
                          </span>
                          <button
                            type="button"
                            className="trn-block-delete-btn"
                            onClick={() =>
                              setProgram(
                                (p) =>
                                  p.days.map((d) =>
                                    d.day_key === day.day_key
                                      ? { ...d, blocks: d.blocks.filter((_, bIdx) => bIdx !== bi) }
                                      : d
                                  )
                              )
                            }
                          >
                            ✕
                          </button>
                        </div>

                        <div className="trn-exercise-picker">
                          <p>Select exercise:</p>
                          <button
                            type="button"
                            className="trn-exercise-btn"
                            onClick={() => {}}
                          >
                            Add New Exercise
                          </button>
                          <p className="trn-small-text">
                            Or search the exercise library from the staff workouts page.
                          </p>
                        </div>

                        <div className="trn-sets-table">
                          {block.sets.map((set, si) => (
                            <div key={si} className="trn-set-row">
                              <span>
                                <input
                                  type="number"
                                  min={1}
                                  value={set.reps_min != null ? String(set.reps_min) : "3"}
                                  onChange={(e) =>
                                    setProgram((p) => {
                                      const dayKey = `day_${di + 1}`;
                                      const blockId = `block_${bi + 1}`;
                                      const day = p.days.find((d) => d.day_key === dayKey);
                                      if (!day) return p;
                                      const block = day.blocks.find((b) => b.block_id === blockId);
                                      if (!block) return p;
                                      const newSets = [...block.sets];
                                      newSets[si] = {
                                        ...newSets[si],
                                        reps_min: parseInt(e.target.value) || 3,
                                      };
                                      const newBlocks = day.blocks.map((b) =>
                                        b.block_id === blockId
                                          ? { ...b, sets: newSets }
                                          : b
                                      );
                                      return {
                                        ...p,
                                        days: p.days.map((d) =>
                                          d.day_key === dayKey
                                            ? { ...d, blocks: newBlocks }
                                            : d
                                        ),
                                      };
                                    })
                                  }
                                />
                                -
                                <input
                                  type="number"
                                  min={1}
                                  value={set.reps_max != null ? String(set.reps_max) : "6"}
                                  onChange={(e) =>
                                    setProgram((p) => {
                                      const dayKey = `day_${di + 1}`;
                                      const blockId = `block_${bi + 1}`;
                                      const day = p.days.find((d) => d.day_key === dayKey);
                                      if (!day) return p;
                                      const block = day.blocks.find((b) => b.block_id === blockId);
                                      if (!block) return p;
                                      const newSets = [...block.sets];
                                      newSets[si] = {
                                        ...newSets[si],
                                        reps_max: parseInt(e.target.value) || 6,
                                      };
                                      const newBlocks = day.blocks.map((b) =>
                                        b.block_id === blockId
                                          ? { ...b, sets: newSets }
                                          : b
                                      );
                                      return {
                                        ...p,
                                        days: p.days.map((d) =>
                                          d.day_key === dayKey
                                            ? { ...d, blocks: newBlocks }
                                            : d
                                        ),
                                      };
                                    })
                                  }
                                />
                              </span>
                              <input
                                type="number"
                                min={0}
                                max={600}
                                value={set.rest_s != null ? String(set.rest_s) : "120"}
                                onChange={(e) =>
                                  setProgram((p) => {
                                    const dayKey = `day_${di + 1}`;
                                    const blockId = `block_${bi + 1}`;
                                    const day = p.days.find((d) => d.day_key === dayKey);
                                    if (!day) return p;
                                    const block = day.blocks.find((b) => b.block_id === blockId);
                                    if (!block) return p;
                                    const newSets = [...block.sets];
                                    newSets[si] = {
                                      ...newSets[si],
                                      rest_s: parseInt(e.target.value) || 120,
                                    };
                                    const newBlocks = day.blocks.map((b) =>
                                      b.block_id === blockId
                                        ? { ...b, sets: newSets }
                                        : b
                                    );
                                    return {
                                      ...p,
                                      days: p.days.map((d) =>
                                        d.day_key === dayKey
                                          ? { ...d, blocks: newBlocks }
                                          : d
                                      ),
                                    };
                                  })
                                }
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") e.preventDefault();
                                }}
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}

                    {day.blocks.length === 0 && (
                      <p className="trn-empty-block">
                        No exercises added yet. Click "Add New Exercise".
                      </p>
                    )}
                  </div>
                </div>
              ))}

              <button
                type="button"
                className="trn-primary-button"
                onClick={addDay}
                style={{ marginTop: "16px" }}
              >
                ADD DAY
              </button>
            </div>
          )}

          <div className="trn-actions">
            <button
              type="button"
              className="trn-secondary-button"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="button"
              className="trn-primary-button"
              onClick={saveProgram}
              disabled={program.name.trim() === "" || loading}
            >
              {loading ? "Saving..." : "SAVE PROGRAM"}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

export default ProgramsPage;