import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { useAuth } from "../../auth/AuthContext";

import {
  getDietAssignments,
  getDietAssignment,
  getDietTemplate,
} from "../../api/client";

import "./DietPage.css";

function normalizeMeals(source) {
  if (!source) {
    return [];
  }

  const meals =
    source.meals ||
    source.items ||
    source.meal_plan ||
    source.foods ||
    [];

  if (!Array.isArray(meals)) {
    return [];
  }

  return meals.map((meal, index) => ({
    time:
      meal.time ||
      meal.meal_time ||
      meal.scheduled_time ||
      "--:--",

    type:
      meal.type ||
      meal.meal_type ||
      meal.category ||
      `MEAL ${String(index + 1).padStart(2, "0")}`,

    title:
      meal.title ||
      meal.name ||
      meal.meal_name ||
      "MEAL",

    description:
      meal.description ||
      meal.notes ||
      meal.detail ||
      "Follow your assigned nutrition plan.",

    calories:
      meal.calories ??
      meal.kcal ??
      meal.energy ??
      null,
  }));
}

function normalizeCalories(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const numeric = Number(value);

  if (Number.isNaN(numeric)) {
    return value;
  }

  return numeric.toLocaleString("en-IN");
}

function findMemberAssignment(data, memberId) {
  const assignments =
    Array.isArray(data)
      ? data
      : Array.isArray(data?.value)
        ? data.value
        : Array.isArray(data?.assignments)
          ? data.assignments
          : [];

  return (
    assignments.find(
      (assignment) =>
        String(
          assignment.member_id ||
            assignment.member ||
            assignment.memberId ||
            "",
        ) === String(memberId),
    ) || null
  );
}

function DietPage() {
  const { memberId } = useAuth();

  const [diet, setDiet] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadDiet() {
      if (!memberId) {
        setLoading(false);
        setError(
          "Your member account is not linked to a Dyno member.",
        );

        return;
      }

      try {
        setLoading(true);
        setError("");

        const assignmentsData =
          await getDietAssignments();

        const assignment =
          findMemberAssignment(
            assignmentsData,
            memberId,
          );

        if (!assignment) {
          setDiet(null);
          return;
        }

        let resolvedAssignment =
          assignment;

        const assignmentId =
          assignment._id ||
          assignment.id ||
          assignment.assignment_id;

        if (assignmentId) {
          try {
            const assignmentData =
              await getDietAssignment(
                assignmentId,
              );

            resolvedAssignment =
              assignmentData?.value ||
              assignmentData ||
              assignment;
          } catch {
            resolvedAssignment =
              assignment;
          }
        }

        let template = null;

        const templateId =
          resolvedAssignment.template_id ||
          resolvedAssignment.diet_template_id ||
          resolvedAssignment.template ||
          resolvedAssignment.diet_id;

        if (
          templateId &&
          typeof templateId === "string"
        ) {
          try {
            const templateData =
              await getDietTemplate(
                templateId,
              );

            template =
              templateData?.value ||
              templateData ||
              null;
          } catch {
            template = null;
          }
        }

        setDiet({
          ...resolvedAssignment,
          template,
        });
      } catch (err) {
        setError(
          err.message ||
            "Unable to load your diet plan.",
        );
      } finally {
        setLoading(false);
      }
    }

    loadDiet();
  }, [memberId]);

  const source = useMemo(() => {
    if (!diet) {
      return null;
    }

    return diet.template || diet;
  }, [diet]);

  const meals = useMemo(
    () => normalizeMeals(source),
    [source],
  );

  const dailyCalories =
    source?.daily_calories ??
    source?.calorie_target ??
    source?.calories ??
    diet?.daily_calories ??
    diet?.calorie_target ??
    diet?.calories ??
    null;

  const waterTarget =
    source?.water_target ??
    source?.water_glasses ??
    diet?.water_target ??
    diet?.water_glasses ??
    8;

  const waterConsumed =
    source?.water_consumed ??
    diet?.water_consumed ??
    0;

  const totalMealCalories = useMemo(
    () =>
      meals.reduce(
        (total, meal) => {
          const calories =
            Number(meal.calories);

          return Number.isNaN(calories)
            ? total
            : total + calories;
        },
        0,
      ),
    [meals],
  );

  if (loading) {
    return (
      <section className="member-diet-page">
        <div className="member-diet-loading">
          <span />
          <span />
          <span />
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="member-diet-page">
        <div className="member-diet-error">
          <Link
            className="member-diet-back"
            to="/member/dashboard"
          >
            ← BACK TO DASHBOARD
          </Link>

          <p className="member-diet-eyebrow">
            TODAY / NUTRITION
          </p>

          <h1>
            PLAN
            <br />
            UNAVAILABLE.
          </h1>

          <span>{error}</span>
        </div>
      </section>
    );
  }

  if (!diet || meals.length === 0) {
    return (
      <section className="member-diet-page">
        <header className="member-diet-header">
          <div>
            <Link
              className="member-diet-back"
              to="/member/dashboard"
            >
              ← BACK TO DASHBOARD
            </Link>

            <p className="member-diet-eyebrow">
              TODAY / NUTRITION
            </p>

            <h1>
              FUEL
              <br />
              YOUR
              <br />
              BODY.
            </h1>
          </div>
        </header>

        <article className="member-diet-hero">
          <div>
            <p>YOUR DAILY PLAN</p>

            <h2>
              PLAN
              <br />
              NOT
              <br />
              ASSIGNED.
            </h2>
          </div>
        </article>

        <section className="member-meals">
          <div className="member-meals-heading">
            <div>
              <p>YOUR PLAN</p>
              <h3>MEALS</h3>
            </div>

            <span>00</span>
          </div>

          <div className="member-diet-empty">
            <strong>
              NO DIET PLAN YET.
            </strong>

            <p>
              Your trainer has not assigned a
              nutrition plan yet.
            </p>
          </div>
        </section>
      </section>
    );
  }

  return (
    <section className="member-diet-page">
      <header className="member-diet-header">
        <div>
          <Link
            className="member-diet-back"
            to="/member/dashboard"
          >
            ← BACK TO DASHBOARD
          </Link>

          <p className="member-diet-eyebrow">
            TODAY / NUTRITION
          </p>

          <h1>
            FUEL
            <br />
            YOUR
            <br />
            BODY.
          </h1>
        </div>

        <div className="member-diet-calorie-card">
          <span>DAILY TARGET</span>

          <strong>
            {dailyCalories !== null
              ? normalizeCalories(
                  dailyCalories,
                )
              : "—"}
          </strong>

          <small>KCAL</small>
        </div>
      </header>

      <article className="member-diet-hero">
        <div>
          <p>YOUR DAILY PLAN</p>

          <h2>
            EAT
            <br />
            WITH
            <br />
            PURPOSE.
          </h2>
        </div>
      </article>

      <section className="member-diet-nutrition">
        <div>
          <span>CALORIES</span>

          <strong>
            {totalMealCalories || "—"}
          </strong>

          <small>
            {dailyCalories !== null
              ? `/ ${normalizeCalories(
                  dailyCalories,
                )} KCAL`
              : "KCAL RECORDED"}
          </small>
        </div>

        <div>
          <span>WATER</span>

          <strong>
            {waterConsumed}
          </strong>

          <small>
            / {waterTarget} GLASSES
          </small>
        </div>

        <div>
          <span>MEALS</span>

          <strong>
            {meals.length}
          </strong>

          <small>TODAY</small>
        </div>
      </section>

      <section className="member-meals">
        <div className="member-meals-heading">
          <div>
            <p>YOUR PLAN</p>

            <h3>MEALS</h3>
          </div>

          <span>
            {String(meals.length).padStart(
              2,
              "0",
            )}
          </span>
        </div>

        {meals.map((meal, index) => (
          <article
            className="member-meal-card"
            key={`${meal.time}-${index}`}
          >
            <time>{meal.time}</time>

            <div>
              <p>{meal.type}</p>

              <h4>{meal.title}</h4>

              <span>
                {meal.description}
              </span>
            </div>

            <strong>
              {meal.calories !== null
                ? `${normalizeCalories(
                    meal.calories,
                  )} KCAL`
                : "—"}
            </strong>

            <button
              type="button"
              aria-label={`View ${meal.title}`}
            >
              ↗
            </button>
          </article>
        ))}
      </section>

      <section className="member-water-card">
        <div>
          <p>HYDRATION</p>

          <h3>
            DRINK
            <br />
            MORE.
          </h3>
        </div>

        <div className="member-water-track">
          {Array.from({
            length: Number(waterTarget) || 8,
          }).map((_, index) => (
            <span
              key={index}
              className={
                index < Number(waterConsumed)
                  ? "is-filled"
                  : ""
              }
            >
              {index + 1}
            </span>
          ))}
        </div>

        <p className="member-water-note">
          Small sips throughout the day are
          easier than trying to catch up at
          night.
        </p>
      </section>
    </section>
  );
}

export default DietPage;