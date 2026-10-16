import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { getWorkoutHistory } from "../../api/client";

import "./WorkoutHistoryPage.css";

const MEMBER_ID =
  localStorage.getItem("dyno_member_id") || "MEM-0001";

function formatDate(value) {
  if (!value) {
    return "UNKNOWN DATE";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "UNKNOWN DATE";
  }

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).toUpperCase();
}

function normalizeHistory(data) {
  if (Array.isArray(data)) {
    return data;
  }

  if (Array.isArray(data?.history)) {
    return data.history;
  }

  if (Array.isArray(data?.results)) {
    return data.results;
  }

  return [];
}

function normalizeExercises(workout) {
  if (!workout) {
    return [];
  }

  const exercises =
    workout.exercises ||
    workout.exercise_list ||
    workout.items ||
    [];

  return Array.isArray(exercises) ? exercises : [];
}

function totalSets(exercises) {
  return exercises.reduce((total, exercise) => {
    const sets = Number(exercise?.sets || 0);
    return total + (Number.isFinite(sets) ? sets : 0);
  }, 0);
}

function WorkoutHistoryPage() {
  const [historyData, setHistoryData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedWorkout, setSelectedWorkout] = useState(null);

  useEffect(() => {
    async function loadHistory() {
      try {
        setLoading(true);
        setError("");

        const data = await getWorkoutHistory(MEMBER_ID);

        setHistoryData(normalizeHistory(data));
      } catch (err) {
        setError(
          err?.message ||
            "Unable to load workout history.",
        );
      } finally {
        setLoading(false);
      }
    }

    loadHistory();
  }, []);

  const history = useMemo(() => {
    return [...historyData].sort((a, b) => {
      const first = new Date(
        a?.workout_date || a?.date || 0,
      ).getTime();

      const second = new Date(
        b?.workout_date || b?.date || 0,
      ).getTime();

      return second - first;
    });
  }, [historyData]);

  return (
    <section className="member-workout-history-page">
      <header className="member-workout-history-header">
        <div>
          <Link
            className="member-workout-history-back"
            to="/member/workout"
          >
            ← TODAY&apos;S WORKOUT
          </Link>

          <p className="member-workout-history-eyebrow">
            WORKOUT / HISTORY
          </p>

          <h1>
            TRAINING
            <br />
            HISTORY.
          </h1>
        </div>

        <div className="member-workout-history-count">
          <span>COMPLETED RECORDS</span>
          <strong>
            {String(history.length).padStart(2, "0")}
          </strong>
        </div>
      </header>

      {loading && (
        <div className="member-workout-history-loading">
          <span />
          <span />
          <span />
        </div>
      )}

      {!loading && error && (
        <div className="member-workout-history-error">
          <p>HISTORY UNAVAILABLE</p>
          <span>{error}</span>
        </div>
      )}

      {!loading && !error && history.length === 0 && (
        <div className="member-workout-history-empty">
          <p>NO HISTORY YET.</p>
          <span>
            Your completed workout records will appear here.
          </span>
        </div>
      )}

      {!loading && !error && history.length > 0 && (
        <section className="member-workout-history-list">
          {history.map((workout, index) => {
            const exercises = normalizeExercises(workout);

            const workoutDate =
              workout?.workout_date ||
              workout?.date;

            const templateName =
              workout?.template_name ||
              workout?.template_key ||
              "WORKOUT";

            const exerciseCount = exercises.length;
            const sets = totalSets(exercises);

            return (
              <article
                className="member-history-card"
                key={
                  workout?.id ||
                  `${workoutDate}-${index}`
                }
                onClick={() =>
                  setSelectedWorkout(workout)
                }
              >
                <div className="member-history-index">
                  {String(index + 1).padStart(2, "0")}
                </div>

                <div className="member-history-main">
                  <p>{formatDate(workoutDate)}</p>

                  <h2>
                    {String(templateName).replace(
                      /_/g,
                      " ",
                    )}
                  </h2>

                  <span>
                    {exerciseCount} EXERCISES ·{" "}
                    {sets || "—"} SETS
                  </span>
                </div>

                <button
                  type="button"
                  aria-label="View workout"
                  onClick={(event) => {
                    event.stopPropagation();
                    setSelectedWorkout(workout);
                  }}
                >
                  ↗
                </button>
              </article>
            );
          })}
        </section>
      )}

      {selectedWorkout && (
        <div
          className="member-workout-history-overlay"
          role="presentation"
          onClick={() => setSelectedWorkout(null)}
        >
          <article
            className="member-workout-history-modal"
            onClick={(event) =>
              event.stopPropagation()
            }
          >
            <button
              type="button"
              className="member-workout-history-close"
              onClick={() =>
                setSelectedWorkout(null)
              }
              aria-label="Close workout"
            >
              ×
            </button>

            <p>WORKOUT RECORD</p>

            <h2>
              {String(
                selectedWorkout?.template_name ||
                  selectedWorkout?.template_key ||
                  "WORKOUT",
              ).replace(/_/g, " ")}
            </h2>

            <span className="member-history-modal-date">
              {formatDate(
                selectedWorkout?.workout_date ||
                  selectedWorkout?.date,
              )}
            </span>

            <div className="member-history-modal-exercises">
              {normalizeExercises(
                selectedWorkout,
              ).map((exercise, index) => (
                <div
                  className="member-history-exercise"
                  key={`${exercise?.name || "exercise"}-${index}`}
                >
                  <span>
                    {String(index + 1).padStart(
                      2,
                      "0",
                    )}
                  </span>

                  <div>
                    <strong>
                      {exercise?.name ||
                        exercise?.exercise_name ||
                        "EXERCISE"}
                    </strong>

                    <small>
                      {exercise?.sets || "—"} SETS
                      {" · "}
                      {exercise?.reps || "—"} REPS
                      {exercise?.weight
                        ? ` · ${exercise.weight}`
                        : ""}
                    </small>
                  </div>
                </div>
              ))}
            </div>
          </article>
        </div>
      )}
    </section>
  );
}

export default WorkoutHistoryPage;