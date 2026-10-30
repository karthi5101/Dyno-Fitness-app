import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { useAuth } from "../../auth/AuthContext";
import {
  completeDailyWorkout,
  getMemberWorkout,
  getWorkoutHistory,
} from "../../api/client";

import "./WorkoutPage.css";

function getDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getTodayDate() {
  return getDateString();
}

function formatDate(value) {
  if (!value) {
    return "TODAY";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "TODAY";
  }

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).toUpperCase();
}

function formatDay(value) {
  if (!value) {
    return "TODAY";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "TODAY";
  }

  return date
    .toLocaleDateString("en-IN", {
      weekday: "long",
    })
    .toUpperCase();
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

  if (!Array.isArray(exercises)) {
    return [];
  }

  return exercises
    .map((exercise, index) => {
      const sets = exercise.sets;
      const reps = exercise.reps;
      const weight = exercise.weight;

      const detailParts = [];

      if (sets !== undefined && sets !== null && sets !== "") {
        detailParts.push(`${sets} SETS`);
      }

      if (reps !== undefined && reps !== null && reps !== "") {
        detailParts.push(`${reps} REPS`);
      }

      if (weight !== undefined && weight !== null && weight !== "") {
        detailParts.push(String(weight).toUpperCase());
      }

      return {
        number: String(index + 1).padStart(2, "0"),

        name:
          exercise.name ||
          exercise.exercise_name ||
          exercise.title ||
          "EXERCISE",

        sets:
          sets !== undefined &&
          sets !== null &&
          sets !== ""
            ? Number(sets)
            : null,

        reps:
          reps !== undefined &&
          reps !== null &&
          reps !== ""
            ? Number(reps)
            : null,

        weight:
          weight !== undefined &&
          weight !== null &&
          weight !== ""
            ? String(weight)
            : null,

        order:
          exercise.order !== undefined
            ? exercise.order
            : index,

        detail:
          detailParts.length > 0
            ? detailParts.join(" · ")
            : "FOLLOW TRAINER PLAN",

        focus:
          exercise.focus ||
          exercise.muscle_group ||
          exercise.target ||
          "FULL BODY",
      };
    })
    .sort((a, b) => Number(a.order) - Number(b.order));
}

function calculateTotalSets(exercises) {
  return exercises.reduce((total, exercise) => {
    return total + (Number(exercise.sets) || 0);
  }, 0);
}

function calculateTotalReps(exercises) {
  return exercises.reduce((total, exercise) => {
    return total + (Number(exercise.reps) || 0);
  }, 0);
}

function WorkoutPage() {
  const { memberId } = useAuth();

  const [workoutData, setWorkoutData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [completing, setCompleting] =
    useState(false);

  const [feedback, setFeedback] =
    useState(null);

  useEffect(() => {
    let active = true;

    async function loadWorkout() {
      if (!memberId) {
        if (active) {
          setLoading(false);
          setError(
            "Your member account is not linked to a Dyno member.",
          );
        }

        return;
      }

      try {
        setLoading(true);
        setError("");

        const data = await getMemberWorkout(
          memberId,
          getTodayDate(),
        );

        let nextData = data;

        if (!data?.workout) {
          const historyResponse =
            await getWorkoutHistory(memberId);

          const history = Array.isArray(
            historyResponse,
          )
            ? historyResponse
            : [];

          const pending = history
            .filter(
              (record) =>
                record?.status === "pending" &&
                Number.isInteger(
                  record?.split_day,
                ),
            )
            .sort(
              (first, second) =>
                new Date(
                  second?.workout_date || 0,
                ).getTime() -
                new Date(
                  first?.workout_date || 0,
                ).getTime(),
            )[0];

          if (pending) {
            nextData = {
              ...data,
              workout: pending,
            };
          }
        }

        if (active) {
          setWorkoutData(nextData);
        }
      } catch (err) {
        if (active) {
          setError(
            err?.message ||
              "Unable to load today's workout.",
          );
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadWorkout();

    return () => {
      active = false;
    };
  }, [memberId]);

  const workout = workoutData?.workout;
  const assignment = workoutData?.assignment;

  const exercises = useMemo(
    () =>
      normalizeExercises(
        workout || assignment,
      ),
    [workout, assignment],
  );

  const totalSets = useMemo(
    () => calculateTotalSets(exercises),
    [exercises],
  );

  const totalReps = useMemo(
    () => calculateTotalReps(exercises),
    [exercises],
  );

  const trainingFocus = workout?.split_day
    ? `DAY ${workout.split_day}${
        workout.split_day_label
          ? ` · ${workout.split_day_label}`
          : ""
      }`
    : workout?.focus ||
      workout?.training_focus ||
      assignment?.focus ||
      assignment?.training_focus ||
      "TODAY'S TRAINING";

  const isSplitWorkout = Number.isInteger(
    workout?.split_day,
  );

  const isCompleted =
    workout?.status === "completed";

  async function handleCompleteWorkout() {
    if (!memberId || !workout?.id || completing) {
      return;
    }

    try {
      setCompleting(true);
      setFeedback(null);

      const result = await completeDailyWorkout(
        memberId,
        workout.id,
      );

      if (result?.workout) {
        setWorkoutData((current) =>
          current
            ? {
                ...current,
                workout: result.workout,
              }
            : current,
        );
      }

      if (result?.already_completed) {
        setFeedback({
          type: "notice",
          text: "This workout was already completed. Your progress is unchanged.",
        });
      } else {
        setFeedback({
          type: "success",
          text: "Workout completed. Your next session moves to the next split day.",
        });
      }
    } catch (err) {
      setFeedback({
        type: "error",
        text:
          err?.message ||
          "Unable to complete this workout.",
      });
    } finally {
      setCompleting(false);
    }
  }

  const workoutType =
    workout?.type ||
    workout?.workout_type ||
    assignment?.type ||
    assignment?.workout_type ||
    "WORKOUT";

  const estimatedTime =
    workout?.estimated_time ||
    workout?.duration ||
    assignment?.estimated_time ||
    "45–60 MIN";

  const trainerNote =
    workout?.trainer_note ||
    workout?.notes ||
    assignment?.trainer_note ||
    "Focus on clean movement and controlled tempo.";

  const workoutDate =
    workout?.workout_date ||
    workout?.date ||
    getTodayDate();

  const isPendingFallback = Boolean(
    workout?.status === "pending" &&
      String(workoutDate).slice(0, 10) !==
        getTodayDate(),
  );

  const templateName =
    workout?.template_name ||
    assignment?.template_name ||
    workout?.template_key ||
    assignment?.template_key ||
    "ASSIGNED PLAN";

  if (loading) {
    return (
      <section className="member-workout-page">
        <div className="member-workout-loading">
          <span />
          <span />
          <span />
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="member-workout-page">
        <div className="member-workout-error">
          <Link
            className="member-workout-back"
            to="/member/dashboard"
          >
            ← BACK TO DASHBOARD
          </Link>

          <p className="member-workout-eyebrow">
            TODAY / WORKOUT
          </p>

          <h1>
            WORKOUT
            <br />
            UNAVAILABLE.
          </h1>

          <span>{error}</span>
        </div>
      </section>
    );
  }

  return (
    <section className="member-workout-page">
      <header className="member-workout-header">
        <div>
          <Link
            className="member-workout-back"
            to="/member/dashboard"
          >
            ← BACK TO DASHBOARD
          </Link>

          <p className="member-workout-eyebrow">
            {isPendingFallback
              ? "PENDING / WORKOUT"
              : "TODAY / WORKOUT"}
          </p>

          <h1>
            {isPendingFallback ? (
              <>
                PENDING
                <br />
                SESSION.
              </>
            ) : (
              <>
                TODAY&apos;S
                <br />
                WORKOUT.
              </>
            )}
          </h1>
        </div>

        <div className="member-workout-meta">
          <span>{formatDay(workoutDate)}</span>

          <strong>{workoutType}</strong>

          <small>{estimatedTime}</small>
        </div>
      </header>

      <article className="member-workout-hero">
        <div>
          <p>TRAINING FOCUS</p>

          <h2>{trainingFocus}</h2>

          <span>{templateName}</span>
        </div>
      </article>

      {isSplitWorkout && (
        <section className="member-workout-completion">
          {isCompleted ? (
            <div className="member-workout-completion-state">
              <span>SESSION STATUS</span>

              <strong>COMPLETED</strong>

              <small>
                {workout?.completed_at
                  ? formatDate(
                      workout.completed_at,
                    )
                  : "RECORDED"}
                {" · "}
                {(
                  workout?.completed_by_role ||
                  "member"
                ).toUpperCase()}
              </small>
            </div>
          ) : (
            <button
              type="button"
              className="member-workout-complete-button"
              onClick={handleCompleteWorkout}
              disabled={completing}
            >
              {completing
                ? "COMPLETING..."
                : "MARK WORKOUT COMPLETE →"}
            </button>
          )}

          {feedback && (
            <p
              className={`member-workout-feedback member-workout-feedback-${feedback.type}`}
            >
              {feedback.text}
            </p>
          )}
        </section>
      )}

      <section className="member-workout-summary">
        <div>
          <span>EXERCISES</span>

          <strong>
            {String(exercises.length).padStart(2, "0")}
          </strong>
        </div>

        <div>
          <span>SETS</span>

          <strong>
            {totalSets || "—"}
          </strong>
        </div>

        <div>
          <span>REPS</span>

          <strong>
            {totalReps || "—"}
          </strong>
        </div>

        <div>
          <span>EST. TIME</span>

          <strong>
            {estimatedTime}
          </strong>
        </div>
      </section>

      <section className="member-workout-list">
        <div className="member-workout-section-heading">
          <div>
            <p>YOUR PLAN</p>

            <h3>EXERCISES</h3>
          </div>

          <span>
            {String(exercises.length).padStart(2, "0")}
          </span>
        </div>

        {exercises.length === 0 ? (
          <div className="member-workout-empty">
            <strong>
              NO WORKOUT ASSIGNED.
            </strong>

            <p>
              Your trainer has not assigned
              today&apos;s workout yet.
            </p>
          </div>
        ) : (
          exercises.map((exercise) => (
            <article
              className="member-exercise-card"
              key={`${exercise.number}-${exercise.name}`}
            >
              <div className="member-exercise-number">
                {exercise.number}
              </div>

              <div className="member-exercise-main">
                <h4>{exercise.name}</h4>

                <p>{exercise.focus}</p>
              </div>

              <div className="member-exercise-detail">
                {exercise.detail}
              </div>

              <button
                type="button"
                aria-label={`View ${exercise.name} details`}
                className="member-exercise-action"
              >
                ↗
              </button>
            </article>
          ))
        )}
      </section>

      <section className="member-workout-note">
        <p>TRAINER NOTE</p>

        <h3>
          CONTROL
          <br />
          EVERY REP.
        </h3>

        <span>{trainerNote}</span>

        <small>
          WORKOUT DATE · {formatDate(workoutDate)}
        </small>
      </section>
    </section>
  );
}

export default WorkoutPage;