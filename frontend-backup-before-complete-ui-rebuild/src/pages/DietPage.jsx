import { useEffect, useMemo, useState } from "react";

import {
  getDietAssignments,
  getDietTemplates,
  getMembers,
} from "../api/client";

import "./DietPage.css";

const DEFAULT_MEMBER_ID = "MEM-0001";

const mealOrder = ["breakfast", "lunch", "dinner"];

function formatMealName(value) {
  if (!value) {
    return "MEAL";
  }

  return String(value)
    .replaceAll("_", " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function formatNumber(value) {
  if (value === null || value === undefined || value === "") {
    return "—";
  }

  const number = Number(value);

  if (Number.isNaN(number)) {
    return String(value);
  }

  return number.toLocaleString("en-IN");
}

function getMealItems(meal) {
  if (!meal) {
    return [];
  }

  if (Array.isArray(meal.items)) {
    return meal.items;
  }

  if (Array.isArray(meal.foods)) {
    return meal.foods;
  }

  if (Array.isArray(meal.food_items)) {
    return meal.food_items;
  }

  return [];
}

function getMealCalories(meal) {
  if (!meal) {
    return 0;
  }

  return (
    Number(meal.calories) ||
    Number(meal.calorie) ||
    Number(meal.total_calories) ||
    0
  );
}

function getMealLabel(meal, fallback) {
  return (
    meal?.name ||
    meal?.title ||
    meal?.meal_name ||
    formatMealName(fallback)
  );
}

function DietPage() {
  const [members, setMembers] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [assignments, setAssignments] = useState([]);

  const [selectedMemberId, setSelectedMemberId] =
    useState(DEFAULT_MEMBER_ID);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadDietData() {
      try {
        setLoading(true);
        setError("");

        const [
          memberData,
          templateData,
          assignmentData,
        ] = await Promise.all([
          getMembers(),
          getDietTemplates(),
          getDietAssignments(),
        ]);

        setMembers(memberData || []);
        setTemplates(templateData || []);

        const normalizedAssignments =
          Array.isArray(assignmentData)
            ? assignmentData
            : assignmentData?.value ||
              assignmentData?.assignments ||
              [];

        setAssignments(normalizedAssignments);

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
          err.message ||
            "Unable to load diet information.",
        );
      } finally {
        setLoading(false);
      }
    }

    loadDietData();
  }, []);

  const selectedMember = useMemo(
    () =>
      members.find(
        (member) =>
          member.member_id === selectedMemberId,
      ),
    [members, selectedMemberId],
  );

  const memberAssignments = useMemo(
    () =>
      assignments.filter(
        (assignment) =>
          assignment.member_id === selectedMemberId,
      ),
    [assignments, selectedMemberId],
  );

  const activeAssignment =
    memberAssignments[memberAssignments.length - 1] ||
    null;

  const assignedTemplate = useMemo(() => {
    if (!activeAssignment) {
      return null;
    }

    return templates.find(
      (template) =>
        template.id === activeAssignment.template_id ||
        template.template_id ===
          activeAssignment.template_id,
    );
  }, [activeAssignment, templates]);

  const dietData =
    activeAssignment?.diet ||
    activeAssignment?.meals
      ? activeAssignment
      : assignedTemplate;

  const meals = useMemo(() => {
    const source = dietData?.meals;

    if (Array.isArray(source)) {
      return source;
    }

    if (source && typeof source === "object") {
      return mealOrder.map((mealKey) => ({
        ...(source[mealKey] || {}),
        name:
          source[mealKey]?.name ||
          formatMealName(mealKey),
        meal_type: mealKey,
      }));
    }

    return [];
  }, [dietData]);

  const normalizedMeals = useMemo(
    () =>
      mealOrder.map((mealKey) => {
        const found = meals.find(
          (meal) =>
            meal?.meal_type === mealKey ||
            meal?.type === mealKey ||
            meal?.key === mealKey ||
            meal?.name?.toLowerCase() === mealKey,
        );

        return (
          found || {
            meal_type: mealKey,
            name: formatMealName(mealKey),
            items: [],
            calories: 0,
          }
        );
      }),
    [meals],
  );

  const totalCalories =
    Number(
      dietData?.total_calories ||
        dietData?.daily_calories ||
        dietData?.calories ||
        0,
    ) ||
    normalizedMeals.reduce(
      (total, meal) =>
        total + getMealCalories(meal),
      0,
    );

  const waterTarget =
    dietData?.water_target ||
    dietData?.water_liters ||
    dietData?.water ||
    3;

  const supplements =
    dietData?.supplements ||
    assignedTemplate?.supplements ||
    [];

  if (loading) {
    return (
      <section className="diet-page">
        <div className="diet-state">
          <span />
          <p>Loading nutrition experience...</p>
        </div>
      </section>
    );
  }

  return (
    <section className="diet-page">
      <header className="diet-page-header">
        <div className="diet-heading-block">
          <p className="dyno-section-label">
            NUTRITION
          </p>

          <h1>
            FUEL YOUR
            <br />
            BODY<span>.</span>
          </h1>

          <p>
            Eat with intention.
            <br />
            Fuel the work you put in.
          </p>
        </div>

        <div className="diet-header-meta">
          <span>MEMBER</span>

          <select
            value={selectedMemberId}
            onChange={(event) =>
              setSelectedMemberId(
                event.target.value,
              )
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
            {selectedMember?.name ||
              "SELECT MEMBER"}
          </strong>
        </div>
      </header>

      {error && (
        <div className="diet-alert">
          {error}
        </div>
      )}

      <div className="diet-hero">
        <div className="diet-hero-copy">
          <p>DAILY NUTRITION</p>

          <h2>
            EAT
            <br />
            WELL.
            <br />
            LIVE
            <br />
            STRONG<span>.</span>
          </h2>

          <small>
            {activeAssignment
              ? "YOUR CURRENT NUTRITION PLAN"
              : "NO PLAN ASSIGNED"}
          </small>
        </div>

        <div className="diet-hero-calories">
          <span>DAILY TARGET</span>
          <strong>
            {formatNumber(totalCalories)}
          </strong>
          <small>KCAL</small>
        </div>
      </div>

      <section className="diet-summary">
        <article>
          <span>CALORIES</span>
          <strong>
            {formatNumber(totalCalories)}
          </strong>
          <small>DAILY TARGET</small>
        </article>

        <article>
          <span>WATER</span>
          <strong>{waterTarget}</strong>
          <small>LITRES / DAY</small>
        </article>

        <article>
          <span>MEALS</span>
          <strong>
            {normalizedMeals.length}
          </strong>
          <small>DAILY MEALS</small>
        </article>

        <article>
          <span>STATUS</span>
          <strong>
            {activeAssignment
              ? "ON"
              : "—"}
          </strong>
          <small>
            {activeAssignment
              ? "CURRENT PLAN"
              : "NOT ASSIGNED"}
          </small>
        </article>
      </section>

      {!activeAssignment && !assignedTemplate ? (
        <div className="diet-empty">
          <p>YOUR NUTRITION PLAN</p>

          <h2>
            FUEL
            <br />
            STARTS
            <br />
            HERE<span>.</span>
          </h2>

          <span>
            A diet plan has not been assigned
            to this member yet.
          </span>
        </div>
      ) : (
        <div className="diet-content-grid">
          <main className="diet-meals">
            <div className="diet-section-heading">
              <div>
                <p className="dyno-section-label">
                  TODAY
                </p>
                <h2>YOUR MEALS</h2>
              </div>

              <span>
                {assignedTemplate?.name ||
                  activeAssignment?.template_name ||
                  "CURRENT PLAN"}
              </span>
            </div>

            <div className="diet-meal-list">
              {normalizedMeals.map(
                (meal, index) => {
                  const items =
                    getMealItems(meal);

                  return (
                    <article
                      className="diet-meal-card"
                      key={
                        meal?.meal_type ||
                        meal?.name ||
                        index
                      }
                    >
                      <div className="diet-meal-number">
                        {String(index + 1).padStart(
                          2,
                          "0",
                        )}
                      </div>

                      <div className="diet-meal-main">
                        <span>
                          {formatMealName(
                            meal?.meal_type ||
                              meal?.type ||
                              `meal ${index + 1}`,
                          )}
                        </span>

                        <h3>
                          {getMealLabel(
                            meal,
                            meal?.meal_type ||
                              `meal ${index + 1}`,
                          )}
                        </h3>

                        {items.length > 0 && (
                          <div className="diet-food-list">
                            {items.map(
                              (
                                item,
                                itemIndex,
                              ) => {
                                const label =
                                  typeof item ===
                                  "string"
                                    ? item
                                    : item?.name ||
                                      item?.food ||
                                      item?.item ||
                                      "Food item";

                                return (
                                  <div
                                    key={`${label}-${itemIndex}`}
                                  >
                                    <span>
                                      {label}
                                    </span>

                                    {typeof item !==
                                      "string" &&
                                      item?.quantity && (
                                        <small>
                                          {
                                            item.quantity
                                          }
                                        </small>
                                      )}
                                  </div>
                                );
                              },
                            )}
                          </div>
                        )}
                      </div>

                      <div className="diet-meal-calories">
                        <span>ENERGY</span>
                        <strong>
                          {getMealCalories(
                            meal,
                          )
                            ? formatNumber(
                                getMealCalories(
                                  meal,
                                ),
                              )
                            : "—"}
                        </strong>

                        {getMealCalories(
                          meal,
                        ) > 0 && (
                          <small>KCAL</small>
                        )}
                      </div>
                    </article>
                  );
                },
              )}
            </div>
          </main>

          <aside className="diet-side-column">
            <section className="diet-water-card">
              <p>HYDRATION</p>

              <h2>
                DRINK
                <br />
                MORE.
              </h2>

              <div className="diet-water-number">
                <strong>
                  {waterTarget}
                </strong>
                <span>L</span>
              </div>

              <p>
                DAILY WATER
                <br />
                TARGET
              </p>

              <div className="diet-water-track">
                <span style={{ width: "0%" }} />
              </div>

              <small>
                TRACK YOUR WATER THROUGHOUT
                THE DAY.
              </small>
            </section>

            <section className="diet-supplement-card">
              <div className="diet-side-card-heading">
                <p>OPTIONAL</p>
                <h2>SUPPLEMENTS</h2>
              </div>

              {Array.isArray(
                supplements,
              ) &&
              supplements.length > 0 ? (
                <div className="diet-supplement-list">
                  {supplements.map(
                    (supplement, index) => {
                      const label =
                        typeof supplement ===
                        "string"
                          ? supplement
                          : supplement?.name ||
                            supplement?.title ||
                            "Supplement";

                      return (
                        <div
                          key={`${label}-${index}`}
                        >
                          <span>
                            {String(
                              index + 1,
                            ).padStart(2, "0")}
                          </span>

                          <strong>
                            {label}
                          </strong>
                        </div>
                      );
                    },
                  )}
                </div>
              ) : (
                <p className="diet-no-supplements">
                  No supplements added to
                  this plan.
                </p>
              )}
            </section>
          </aside>
        </div>
      )}
    </section>
  );
}

export default DietPage;