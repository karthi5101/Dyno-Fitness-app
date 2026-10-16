import { useEffect, useMemo, useState } from "react";

import {
  assignWorkoutTemplate,
  deleteDailyWorkout,
  generateDailyWorkout,
  getMemberWorkout,
  getWorkoutHistory,
  getWorkoutTemplates,
  updateDailyWorkout,
} from "../../api/client";

import "./MemberWorkoutSection.css";

function getToday() {
  const date = new Date();

  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function formatDate(value) {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function normalizeArray(response) {
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

function getRecordId(record) {
  return (
    record?.id ||
    record?._id ||
    `${record?.member_id}-${record?.workout_date}`
  );
}

function normalizeExercises(exercises = []) {
  if (!Array.isArray(exercises)) {
    return [];
  }

  return exercises.map((exercise, index) => ({
    name: exercise?.name || "",
    sets: Number(exercise?.sets) || 1,
    reps: Number(exercise?.reps) || 1,
    weight:
      exercise?.weight === null ||
      exercise?.weight === undefined
        ? ""
        : String(exercise.weight),
    order: index,
  }));
}

function createExercise() {
  return {
    name: "",
    sets: 3,
    reps: 10,
    weight: "",
    order: 0,
  };
}

function MemberWorkoutSection({ memberId }) {
  const [templates, setTemplates] = useState([]);
  const [assignment, setAssignment] = useState(null);
  const [dailyWorkout, setDailyWorkout] = useState(null);
  const [history, setHistory] = useState([]);

  const [selectedTemplateId, setSelectedTemplateId] =
    useState("");

  const [selectedDate, setSelectedDate] =
    useState(getToday());

  const [exercises, setExercises] = useState([]);

  const [loading, setLoading] = useState(true);
  const [historyLoading, setHistoryLoading] =
    useState(false);

  const [saving, setSaving] = useState(false);
  const [assigning, setAssigning] =
    useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const today = getToday();

  const isToday = selectedDate === today;

  async function loadWorkout(date = selectedDate) {
    try {
      setLoading(true);
      setError("");

      const [
        workoutData,
        templateData,
        historyData,
      ] = await Promise.all([
        getMemberWorkout(memberId, date),
        getWorkoutTemplates(),
        getWorkoutHistory(memberId),
      ]);

      const nextTemplates =
        normalizeArray(templateData);

      const nextHistory =
        normalizeArray(historyData);

      const nextAssignment =
        workoutData?.assignment || null;

      const nextDailyWorkout =
        workoutData?.workout || null;

      setTemplates(nextTemplates);
      setHistory(nextHistory);
      setAssignment(nextAssignment);
      setDailyWorkout(nextDailyWorkout);

      setExercises(
        normalizeExercises(
          nextDailyWorkout?.exercises || [],
        ),
      );

      setSelectedTemplateId(
        nextAssignment?.template_id
          ? String(nextAssignment.template_id)
          : "",
      );
    } catch (err) {
      setError(
        err?.message ||
          "We couldn't load this member's workout.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function loadHistory() {
    try {
      setHistoryLoading(true);

      const response =
        await getWorkoutHistory(memberId);

      setHistory(normalizeArray(response));
    } catch (err) {
      setError(
        err?.message ||
          "We couldn't refresh workout history.",
      );
    } finally {
      setHistoryLoading(false);
    }
  }

  useEffect(() => {
    if (!memberId) {
      return;
    }

    loadWorkout(selectedDate);
  }, [memberId, selectedDate]);

  const selectedTemplate = useMemo(
    () =>
      templates.find(
        (template) =>
          String(
            template?.id ||
              template?._id ||
              "",
          ) ===
          String(selectedTemplateId),
      ) || null,
    [templates, selectedTemplateId],
  );

  async function handleAssignTemplate() {
    if (!selectedTemplateId) {
      setError(
        "Select a workout template first.",
      );
      return;
    }

    try {
      setAssigning(true);
      setError("");
      setSuccess("");

      const result =
        await assignWorkoutTemplate(
          memberId,
          selectedTemplateId,
        );

      setAssignment(result);

      setSuccess(
        "Workout template assigned to this member.",
      );

      await loadWorkout(selectedDate);
    } catch (err) {
      setError(
        err?.message ||
          "We couldn't assign this workout template.",
      );
    } finally {
      setAssigning(false);
    }
  }

  async function handleGenerateWorkout() {
    if (!assignment) {
      setError(
        "Assign a workout template before generating a workout.",
      );
      return;
    }

    try {
      setSaving(true);
      setError("");
      setSuccess("");

      const created =
        await generateDailyWorkout(
          memberId,
          selectedDate,
        );

      setDailyWorkout(created);

      setExercises(
        normalizeExercises(
          created?.exercises || [],
        ),
      );

      setSuccess(
        isToday
          ? "Today's workout has been created."
          : `Workout for ${formatDate(
              selectedDate,
            )} has been created.`,
      );

      await loadHistory();
    } catch (err) {
      setError(
        err?.message ||
          "We couldn't generate this workout.",
      );
    } finally {
      setSaving(false);
    }
  }

  function updateExercise(
    index,
    field,
    value,
  ) {
    setExercises((current) =>
      current.map(
        (exercise, exerciseIndex) =>
          exerciseIndex === index
            ? {
                ...exercise,
                [field]:
                  field === "sets" ||
                  field === "reps"
                    ? Number(value)
                    : value,
              }
            : exercise,
      ),
    );
  }

  function addExercise() {
    setExercises((current) => [
      ...current,
      {
        ...createExercise(),
        order: current.length,
      },
    ]);
  }

  function removeExercise(index) {
    setExercises((current) =>
      current
        .filter(
          (_, exerciseIndex) =>
            exerciseIndex !== index,
        )
        .map((exercise, exerciseIndex) => ({
          ...exercise,
          order: exerciseIndex,
        })),
    );
  }

  async function handleSaveWorkout() {
    if (!dailyWorkout) {
      setError(
        "Generate this day's workout before saving changes.",
      );
      return;
    }

    try {
      setSaving(true);
      setError("");
      setSuccess("");

      const updated =
        await updateDailyWorkout(
          memberId,
          exercises.map((exercise, index) => ({
            ...exercise,
            order: index,
          })),
          selectedDate,
        );

      setDailyWorkout(updated);

      setExercises(
        normalizeExercises(
          updated?.exercises || [],
        ),
      );

      setSuccess(
        isToday
          ? "Today's workout has been updated."
          : `Workout for ${formatDate(
              selectedDate,
            )} has been updated.`,
      );

      await loadHistory();
    } catch (err) {
      setError(
        err?.message ||
          "We couldn't save this workout.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteWorkout() {
    if (!dailyWorkout) {
      return;
    }

    const confirmed = window.confirm(
      `Delete the workout for ${formatDate(
        selectedDate,
      )}?`,
    );

    if (!confirmed) {
      return;
    }

    try {
      setSaving(true);
      setError("");
      setSuccess("");

      await deleteDailyWorkout(
        memberId,
        selectedDate,
      );

      setDailyWorkout(null);
      setExercises([]);

      setSuccess(
        isToday
          ? "Today's workout has been removed."
          : `Workout for ${formatDate(
              selectedDate,
            )} has been removed.`,
      );

      await loadHistory();
    } catch (err) {
      setError(
        err?.message ||
          "We couldn't delete this workout.",
      );
    } finally {
      setSaving(false);
    }
  }

  function handleHistorySelect(date) {
    if (!date) {
      return;
    }

    setError("");
    setSuccess("");
    setSelectedDate(date);
  }

  function handleResetToToday() {
    setError("");
    setSuccess("");
    setSelectedDate(today);
  }

  if (loading) {
    return (
      <section className="member-workout-section">
        <div className="member-workout-state">
          <span className="staff-loader" />

          <p>
            Loading member workout...
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="member-workout-section">
      <div className="member-profile-section-heading">
        <div>
          <p className="member-profile-eyebrow">
            MEMBER / WORKOUT
          </p>

          <h2>
            TRAIN WITH INTENT.
          </h2>
        </div>

        <p>
          Assign the default plan, generate
          daily workouts, edit individual days
          and preserve the member&apos;s history.
        </p>
      </div>

      {error && (
        <div className="member-workout-message member-workout-message-error">
          {error}
        </div>
      )}

      {success && (
        <div className="member-workout-message member-workout-message-success">
          {success}
        </div>
      )}

      <div className="member-workout-overview">
        <article className="member-workout-overview-card member-workout-overview-card-dark">
          <span>
            DEFAULT PLAN
          </span>

          <strong>
            {assignment?.template_name ||
              "NOT ASSIGNED"}
          </strong>

          <small>
            {assignment
              ? `Assigned ${formatDate(
                  assignment.updated_at ||
                    assignment.created_at,
                )}`
              : "Choose a reusable workout template below."}
          </small>
        </article>

        <article className="member-workout-overview-card">
          <span>
            {isToday
              ? "TODAY"
              : "SELECTED DATE"}
          </span>

          <strong>
            {dailyWorkout
              ? "READY"
              : "NOT CREATED"}
          </strong>

          <small>
            {dailyWorkout
              ? `${exercises.length} exercises · ${formatDate(
                  selectedDate,
                )}`
              : `No workout for ${formatDate(
                  selectedDate,
                )}.`}
          </small>
        </article>

        <article className="member-workout-overview-card">
          <span>
            HISTORY
          </span>

          <strong>
            {history.length}
          </strong>

          <small>
            Recorded daily workouts
          </small>
        </article>
      </div>

      <div className="member-workout-assignment">
        <div>
          <p className="member-profile-eyebrow">
            DEFAULT WORKOUT
          </p>

          <h3>
            Choose the member&apos;s plan.
          </h3>

          <p>
            This remains the member&apos;s
            default template until staff changes
            it. Existing daily snapshots remain
            independent.
          </p>
        </div>

        <div className="member-workout-assignment-controls">
          <select
            value={selectedTemplateId}
            onChange={(event) =>
              setSelectedTemplateId(
                event.target.value,
              )
            }
            disabled={assigning}
          >
            <option value="">
              Select workout template
            </option>

            {templates.map((template) => {
              const templateId =
                template?.id ||
                template?._id ||
                template?.template_key;

              return (
                <option
                  key={templateId}
                  value={templateId}
                >
                  {template.name ||
                    template.template_key}
                </option>
              );
            })}
          </select>

          <button
            type="button"
            className="member-workout-button member-workout-button-dark"
            onClick={
              handleAssignTemplate
            }
            disabled={
              assigning ||
              !selectedTemplateId
            }
          >
            {assigning
              ? "ASSIGNING..."
              : assignment
                ? "CHANGE PLAN →"
                : "ASSIGN PLAN →"}
          </button>
        </div>
      </div>

      <div className="member-workout-builder">
        <div className="member-workout-builder-header">
          <div>
            <p className="member-profile-eyebrow">
              WORKOUT DATE
            </p>

            <h3>
              {isToday
                ? "TODAY'S WORKOUT."
                : `${formatDate(
                    selectedDate,
                  ).toUpperCase()}.`}
            </h3>

            <span>
              {dailyWorkout
                ? `${exercises.length} exercises`
                : "Generate a workout from the member's current assigned template."}
            </span>
          </div>

          <div className="member-workout-builder-actions">
            {!isToday && (
              <button
                type="button"
                className="member-workout-button member-workout-button-outline"
                onClick={
                  handleResetToToday
                }
                disabled={saving}
              >
                TODAY
              </button>
            )}

            {!dailyWorkout && (
              <button
                type="button"
                className="member-workout-button member-workout-button-dark"
                onClick={
                  handleGenerateWorkout
                }
                disabled={
                  saving ||
                  !assignment
                }
              >
                {saving
                  ? "GENERATING..."
                  : "GENERATE WORKOUT →"}
              </button>
            )}

            {dailyWorkout && (
              <>
                <button
                  type="button"
                  className="member-workout-button member-workout-button-outline"
                  onClick={addExercise}
                  disabled={saving}
                >
                  + ADD EXERCISE
                </button>

                <button
                  type="button"
                  className="member-workout-button member-workout-button-dark"
                  onClick={
                    handleSaveWorkout
                  }
                  disabled={saving}
                >
                  {saving
                    ? "SAVING..."
                    : "SAVE WORKOUT →"}
                </button>
              </>
            )}
          </div>
        </div>

        <div className="member-workout-date-control">
          <label>
            <span>
              SELECT WORKOUT DATE
            </span>

            <input
              type="date"
              value={selectedDate}
              onChange={(event) => {
                setError("");
                setSuccess("");
                setSelectedDate(
                  event.target.value,
                );
              }}
              disabled={saving}
            />
          </label>

          {selectedTemplate && (
            <small>
              New workouts are generated from{" "}
              <strong>
                {selectedTemplate.name ||
                  selectedTemplate.template_key}
              </strong>
              .
            </small>
          )}
        </div>

        {!dailyWorkout ? (
          <div className="member-workout-empty">
            <span>/</span>

            <strong>
              {isToday
                ? "TODAY IS READY TO BE BUILT."
                : "THIS DATE IS READY TO BE BUILT."}
            </strong>

            <p>
              Generate the workout using the
              member&apos;s current default template.
              Once created, this day becomes an
              independent workout snapshot and can
              be edited without changing the template.
            </p>
          </div>
        ) : (
          <div className="member-workout-exercises">
            {exercises.length === 0 ? (
              <div className="member-workout-empty">
                <strong>
                  NO EXERCISES.
                </strong>

                <p>
                  Add the first exercise to build
                  this workout.
                </p>
              </div>
            ) : (
              exercises.map(
                (exercise, index) => (
                  <article
                    className="member-workout-exercise"
                    key={`${index}-${exercise.name}`}
                  >
                    <div className="member-workout-exercise-number">
                      {String(
                        index + 1,
                      ).padStart(2, "0")}
                    </div>

                    <div className="member-workout-exercise-fields">
                      <label>
                        <span>
                          EXERCISE
                        </span>

                        <input
                          value={
                            exercise.name
                          }
                          placeholder="Exercise name"
                          onChange={(
                            event,
                          ) =>
                            updateExercise(
                              index,
                              "name",
                              event.target.value,
                            )
                          }
                        />
                      </label>

                      <label>
                        <span>
                          SETS
                        </span>

                        <input
                          type="number"
                          min="1"
                          value={
                            exercise.sets
                          }
                          onChange={(
                            event,
                          ) =>
                            updateExercise(
                              index,
                              "sets",
                              event.target.value,
                            )
                          }
                        />
                      </label>

                      <label>
                        <span>
                          REPS
                        </span>

                        <input
                          type="number"
                          min="1"
                          value={
                            exercise.reps
                          }
                          onChange={(
                            event,
                          ) =>
                            updateExercise(
                              index,
                              "reps",
                              event.target.value,
                            )
                          }
                        />
                      </label>

                      <label>
                        <span>
                          WEIGHT
                        </span>

                        <input
                          value={
                            exercise.weight
                          }
                          placeholder="Optional"
                          onChange={(
                            event,
                          ) =>
                            updateExercise(
                              index,
                              "weight",
                              event.target.value,
                            )
                          }
                        />
                      </label>
                    </div>

                    <button
                      type="button"
                      className="member-workout-delete"
                      onClick={() =>
                        removeExercise(
                          index,
                        )
                      }
                      disabled={saving}
                    >
                      REMOVE
                    </button>
                  </article>
                ),
              )
            )}

            {dailyWorkout && (
              <div className="member-workout-delete-day">
                <button
                  type="button"
                  onClick={
                    handleDeleteWorkout
                  }
                  disabled={saving}
                >
                  DELETE{" "}
                  {isToday
                    ? "TODAY'S"
                    : "SELECTED DAY'S"}{" "}
                  WORKOUT
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="member-workout-history">
        <div className="member-workout-history-heading">
          <div>
            <p className="member-profile-eyebrow">
              HISTORY
            </p>

            <h3>
              PREVIOUS WORKOUTS.
            </h3>
          </div>

          <button
            type="button"
            onClick={loadHistory}
            disabled={historyLoading}
          >
            {historyLoading
              ? "REFRESHING..."
              : "REFRESH"}
          </button>
        </div>

        {history.length === 0 ? (
          <div className="member-workout-history-empty">
            No workout records for this member
            yet.
          </div>
        ) : (
          <div className="member-workout-history-list">
            {history.map((record) => {
              const recordDate =
                record?.workout_date
                  ? String(
                      record.workout_date,
                    ).slice(0, 10)
                  : "";

              const active =
                recordDate === selectedDate;

              return (
                <button
                  type="button"
                  key={getRecordId(
                    record,
                  )}
                  className={`member-workout-history-row ${
                    active
                      ? "member-workout-history-row-active"
                      : ""
                  }`}
                  onClick={() =>
                    handleHistorySelect(
                      recordDate,
                    )
                  }
                >
                  <div>
                    <span>
                      DATE
                    </span>

                    <strong>
                      {formatDate(
                        record.workout_date,
                      )}
                    </strong>
                  </div>

                  <div>
                    <span>
                      PLAN
                    </span>

                    <strong>
                      {record.template_key ||
                        "CUSTOM"}
                    </strong>
                  </div>

                  <div>
                    <span>
                      EXERCISES
                    </span>

                    <strong>
                      {record.exercises
                        ?.length || 0}
                    </strong>
                  </div>

                  <span>
                    →
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}

export default MemberWorkoutSection;