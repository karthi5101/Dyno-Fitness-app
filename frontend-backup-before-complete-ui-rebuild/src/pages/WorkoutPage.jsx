import { useEffect, useMemo, useState } from "react";

import {
  assignWorkoutTemplate,
  getMemberWorkout,
  getMembers,
  getWorkoutTemplates,
} from "../api/client";

import "./WorkoutPage.css";

const DEFAULT_MEMBER_ID = "MEM-0001";

function formatDate(dateValue) {
  if (!dateValue) {
    return "TODAY";
  }

  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) {
    return String(dateValue).slice(0, 10);
  }

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatTemplateKey(value) {
  if (!value) {
    return "WORKOUT";
  }

  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function WorkoutPage() {
  const [members, setMembers] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [selectedMemberId, setSelectedMemberId] =
    useState(DEFAULT_MEMBER_ID);
  const [workout, setWorkout] = useState(null);
  const [assignment, setAssignment] = useState(null);

  const [loading, setLoading] = useState(true);
  const [workoutLoading, setWorkoutLoading] = useState(false);
  const [assigning, setAssigning] = useState(false);

  const [error, setError] = useState("");
  const [actionMessage, setActionMessage] = useState("");

  useEffect(() => {
    async function loadInitialData() {
      try {
        setLoading(true);
        setError("");

        const [memberData, templateData] = await Promise.all([
          getMembers(),
          getWorkoutTemplates(),
        ]);

        setMembers(memberData || []);
        setTemplates(templateData || []);

        if (
          memberData?.length > 0 &&
          !memberData.some(
            (member) => member.member_id === selectedMemberId,
          )
        ) {
          setSelectedMemberId(memberData[0].member_id);
        }
      } catch (err) {
        setError(
          err.message || "Unable to load workout information.",
        );
      } finally {
        setLoading(false);
      }
    }

    loadInitialData();
  }, []);

  useEffect(() => {
    if (!selectedMemberId) {
      return;
    }

    async function loadMemberWorkout() {
      try {
        setWorkoutLoading(true);
        setError("");
        setActionMessage("");

        const data = await getMemberWorkout(selectedMemberId);

        setWorkout(data?.workout || data || null);
        setAssignment(data?.assignment || null);
      } catch (err) {
        const message = err.message || "";

        if (
          message.toLowerCase().includes("not found") ||
          message.toLowerCase().includes("no workout")
        ) {
          setWorkout(null);
          setAssignment(null);
          return;
        }

        setError(message || "Unable to load today's workout.");
      } finally {
        setWorkoutLoading(false);
      }
    }

    loadMemberWorkout();
  }, [selectedMemberId]);

  const selectedMember = useMemo(
    () =>
      members.find(
        (member) => member.member_id === selectedMemberId,
      ),
    [members, selectedMemberId],
  );

  async function handleAssignTemplate(template) {
    if (!selectedMemberId || !template?.id) {
      return;
    }

    try {
      setAssigning(true);
      setError("");
      setActionMessage("");

      const result = await assignWorkoutTemplate(
        selectedMemberId,
        template.id,
      );

      setAssignment(result);
      setActionMessage(
        `${template.name} assigned to ${selectedMember?.name || "member"}.`,
      );
    } catch (err) {
      setError(
        err.message || "Unable to assign this workout template.",
      );
    } finally {
      setAssigning(false);
    }
  }

  if (loading) {
    return (
      <section className="workout-page">
        <div className="workout-state">
          <span className="workout-state-line" />
          <p>Loading workout experience...</p>
        </div>
      </section>
    );
  }

  return (
    <section className="workout-page">
      <header className="workout-page-header">
        <div className="workout-heading-block">
          <p className="dyno-section-label">TRAINING</p>

          <h1>
            TODAY&apos;S
            <br />
            WORKOUT<span>.</span>
          </h1>

          <p>
            Build consistency. Train with purpose.
            <br />
            One session at a time.
          </p>
        </div>

        <div className="workout-header-meta">
          <span>MEMBER</span>

          <select
            value={selectedMemberId}
            onChange={(event) =>
              setSelectedMemberId(event.target.value)
            }
            aria-label="Select member"
          >
            {members.map((member) => (
              <option
                key={member.member_id}
                value={member.member_id}
              >
                {member.name} — {member.member_id}
              </option>
            ))}
          </select>

          <strong>
            {selectedMember?.name || "SELECT MEMBER"}
          </strong>

          <small>{formatDate(new Date())}</small>
        </div>
      </header>

      {error && (
        <div className="workout-alert workout-alert-error">
          <span>{error}</span>
        </div>
      )}

      {actionMessage && (
        <div className="workout-alert workout-alert-success">
          <span>{actionMessage}</span>
        </div>
      )}

      <div className="workout-hero">
        <div className="workout-hero-copy">
          <p className="workout-hero-eyebrow">
            {assignment?.template_name || "TRAIN WITH PURPOSE"}
          </p>

          <h2>
            TRAIN.
            <br />
            MOVE.
            <br />
            BECOME<span>.</span>
          </h2>

          <p className="workout-hero-description">
            {workout?.exercises?.length
              ? `${workout.exercises.length} exercises programmed for today's session.`
              : "Your session is ready when you are."}
          </p>
        </div>

        <div className="workout-hero-number">
          <span>SESSION</span>
          <strong>
            {workout?.exercises?.length
              ? String(workout.exercises.length).padStart(2, "0")
              : "00"}
          </strong>
        </div>
      </div>

      <div className="workout-content-grid">
        <div className="workout-main-column">
          <div className="workout-section-heading">
            <div>
              <p className="dyno-section-label">TODAY</p>
              <h2>EXERCISES</h2>
            </div>

            <span>
              {workoutLoading
                ? "LOADING"
                : `${workout?.exercises?.length || 0} MOVES`}
            </span>
          </div>

          {workoutLoading ? (
            <div className="workout-exercise-skeletons">
              {[1, 2, 3].map((item) => (
                <div
                  className="workout-exercise-skeleton"
                  key={item}
                >
                  <span />
                  <div>
                    <span />
                    <span />
                  </div>
                </div>
              ))}
            </div>
          ) : workout?.exercises?.length ? (
            <div className="workout-exercise-list">
              {workout.exercises
                .slice()
                .sort(
                  (first, second) =>
                    (first.order ?? 0) - (second.order ?? 0),
                )
                .map((exercise, index) => (
                  <article
                    className="workout-exercise-card"
                    key={`${exercise.name}-${index}`}
                  >
                    <div className="workout-exercise-index">
                      {String(index + 1).padStart(2, "0")}
                    </div>

                    <div className="workout-exercise-name">
                      <span>EXERCISE</span>
                      <h3>{exercise.name}</h3>
                    </div>

                    <div className="workout-exercise-stat">
                      <span>SETS</span>
                      <strong>{exercise.sets ?? "—"}</strong>
                    </div>

                    <div className="workout-exercise-stat">
                      <span>REPS</span>
                      <strong>{exercise.reps ?? "—"}</strong>
                    </div>

                    <div className="workout-exercise-stat workout-exercise-weight">
                      <span>WEIGHT</span>
                      <strong>
                        {exercise.weight
                          ? `${exercise.weight} KG`
                          : "—"}
                      </strong>
                    </div>
                  </article>
                ))}
            </div>
          ) : (
            <div className="workout-empty">
              <span>NO SESSION</span>
              <h3>WORKOUT NOT GENERATED.</h3>
              <p>
                Assign a training template to this member to
                prepare their workout.
              </p>
            </div>
          )}
        </div>

        <aside className="workout-side-column">
          <div className="workout-side-heading">
            <p className="dyno-section-label">PROGRAMS</p>
            <h2>SELECT A TEMPLATE</h2>
          </div>

          <div className="workout-template-list">
            {templates.map((template, index) => {
              const isAssigned =
                assignment?.template_id === template.id;

              return (
                <article
                  className={`workout-template-card ${
                    isAssigned
                      ? "workout-template-card-active"
                      : ""
                  }`}
                  key={template.id}
                >
                  <div className="workout-template-top">
                    <span>
                      {String(index + 1).padStart(2, "0")}
                    </span>

                    {isAssigned && (
                      <small>ACTIVE</small>
                    )}
                  </div>

                  <h3>{template.name}</h3>

                  <p>
                    {template.description ||
                      `${formatTemplateKey(template.template_key)} training program.`}
                  </p>

                  <div className="workout-template-footer">
                    <span>
                      {template.exercises?.length || 0} EXERCISES
                    </span>

                    <button
                      type="button"
                      disabled={assigning || isAssigned}
                      onClick={() =>
                        handleAssignTemplate(template)
                      }
                    >
                      {isAssigned
                        ? "ASSIGNED"
                        : assigning
                          ? "SAVING"
                          : "ASSIGN"}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </aside>
      </div>
    </section>
  );
}

export default WorkoutPage;