import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { useAuth } from "../../auth/AuthContext";

import {
  getDietAssignments,
  getDietTemplates,
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

  return meals.map((meal, index) => {
    const mealType =
      meal.meal_type ||
      meal.type ||
      meal.category ||
      "";

    const items = Array.isArray(meal.items)
      ? meal.items
      : null;

    const itemSummary = items
      ? items
          .map((item) =>
            [item?.name, item?.quantity]
              .filter(
                (part) =>
                  part !== null &&
                  part !== undefined &&
                  String(part).trim() !== "",
              )
              .join(" — "),
          )
          .filter(Boolean)
          .join(" · ")
      : "";

    return {
      time:
        meal.time ||
        meal.meal_time ||
        meal.scheduled_time ||
        (mealType
          ? mealType
              .replace(/_/g, " ")
              .toUpperCase()
          : `--:--`),

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
        itemSummary ||
        "Follow your assigned nutrition plan.",

      calories:
        meal.calories ??
        meal.kcal ??
        meal.energy ??
        null,
    };
  });
}

function formatAssignmentDate(value) {
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

function normalizeCalories(value) {  if (value === null || value === undefined || value === "") {
    return null;
  }

  const numeric = Number(value);

  if (Number.isNaN(numeric)) {
    return value;
  }

  return numeric.toLocaleString("en-IN");
}

function DietPage() {
  const { memberId } = useAuth();

  const [diet, setDiet] = useState(null);
  const [history, setHistory] = useState([]);
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

        const [assignmentsData, templatesData] =
          await Promise.all([
            getDietAssignments(),
            getDietTemplates(),
          ]);

        const assignments = Array.isArray(
          assignmentsData,
        )
          ? assignmentsData
          : Array.isArray(assignmentsData?.value)
            ? assignmentsData.value
            : [];

        const memberAssignments =
          assignments.filter(
            (assignment) =>
              String(
                assignment?.member_id || "",
              ) === String(memberId),
          );

        setHistory(memberAssignments);

        const assignment = memberAssignments[0] || null;

        if (!assignment) {
          setDiet(null);
          return;
        }

        const resolvedAssignment = assignment;

        /*
         * A diet assignment stores the template key.
         * The template itself carries the meals and the
         * daily calorie target.
         */
        const templates = Array.isArray(
          templatesData,
        )
          ? templatesData
          : Array.isArray(templatesData?.value)
            ? templatesData.value
            : [];

        const template =
          templates.find(
            (item) =>
              item?.template_key ===
              resolvedAssignment.template_key,
          ) || null;

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
    source?.target_calories ??
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

      {history.length > 1 && (
        <section className="member-diet-history">
          <div className="member-meals-heading">
            <div>
              <p>YOUR PLAN</p>
              <h3>PREVIOUS PLANS</h3>
            </div>

            <span>
              {String(history.length).padStart(2, "0")}
            </span>
          </div>

          <div className="member-diet-history-list">
            {history.map((assignment) => (
              <article
                key={
                  assignment.id ||
                  assignment._id ||
                  `${assignment.template_key}-${assignment.assigned_date}`
                }
              >
                <div>
                  <span>PLAN</span>

                  <strong>
                    {assignment.template_key ||
                      "PLAN"}
                  </strong>
                </div>

                <div>
                  <span>ASSIGNED</span>

                  <strong>
                    {formatAssignmentDate(
                      assignment.assigned_date,
                    )}
                  </strong>
                </div>

                <span
                  className={
                    String(
                      assignment.status || "",
                    ).toLowerCase() === "active"
                      ? "is-active"
                      : ""
                  }
                >
                  {String(
                    assignment.status || "active",
                  ).toUpperCase()}
                </span>
              </article>
            ))}
          </div>
        </section>
      )}

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