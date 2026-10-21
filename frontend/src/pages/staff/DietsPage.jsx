import { useEffect, useMemo, useState } from "react";

import { getMembers } from "../../api/client";
import { getAuthHeaders } from "../../api/client";

import "./DietsPage.css";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  "http://127.0.0.1:8000/api";

async function request(endpoint, options = {}) {
  const response = await fetch(
    `${API_BASE_URL}${endpoint}`,
    {
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeaders(),
        ...(options.headers || {}),
      },
      ...options,
    },
  );

  let data = null;

  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    throw new Error(
      data?.detail ||
        data?.message ||
        "Diet request failed.",
    );
  }

  return data;
}

const emptyMeal = {
  name: "",
  calories: "",
  items: [],
};

function DietsPage() {
  const [templates, setTemplates] = useState([]);
  const [members, setMembers] = useState([]);
  const [selectedTemplate, setSelectedTemplate] =
    useState(null);
  const [selectedMember, setSelectedMember] =
    useState("");
  const [memberSearch, setMemberSearch] =
    useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [meals, setMeals] = useState([]);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        setError("");

        const [
          templateData,
          memberData,
        ] = await Promise.all([
          request("/diets/templates/"),
          getMembers(),
        ]);

        const nextTemplates =
          Array.isArray(templateData)
            ? templateData
            : templateData?.value || [];

        setTemplates(nextTemplates);

        setMembers(
          Array.isArray(memberData)
            ? memberData
            : [],
        );
      } catch (err) {
        setError(
          err.message ||
            "Unable to load diet builder.",
        );
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  const activeMembers = useMemo(
    () =>
      members.filter(
        (member) =>
          member.status === "active",
      ),
    [members],
  );

  const filteredMembers = useMemo(() => {
    const query = memberSearch
      .trim()
      .toLowerCase();

    if (!query) {
      return activeMembers;
    }

    return activeMembers.filter(
      (member) =>
        [
          member.name,
          member.member_id,
          member.phone,
        ]
          .filter(Boolean)
          .some((value) =>
            String(value)
              .toLowerCase()
              .includes(query),
          ),
    );
  }, [
    activeMembers,
    memberSearch,
  ]);

  function chooseTemplate(template) {
    setSelectedTemplate(template);
    setError("");
    setSuccess("");

    setMeals(
      (template.meals || []).map(
        (meal) => ({
          ...meal,
          items: [
            ...(meal.items || []),
          ],
        }),
      ),
    );
  }

  function updateMeal(
    index,
    field,
    value,
  ) {
    setMeals((current) =>
      current.map(
        (meal, mealIndex) =>
          mealIndex === index
            ? {
                ...meal,
                [field]: value,
              }
            : meal,
      ),
    );
  }

  function addMeal() {
    setMeals((current) => [
      ...current,
      {
        ...emptyMeal,
        items: [],
      },
    ]);
  }

  function removeMeal(index) {
    setMeals((current) =>
      current.filter(
        (_, mealIndex) =>
          mealIndex !== index,
      ),
    );
  }

  async function assignDiet() {
    if (
      !selectedTemplate ||
      !selectedMember
    ) {
      setError(
        "Select a diet template and member first.",
      );
      return;
    }

    try {
      setSaving(true);
      setError("");
      setSuccess("");

      await request(
        "/diets/assignments/",
        {
          method: "POST",
          body: JSON.stringify({
            member_id:
              selectedMember,
            template_id:
              selectedTemplate._id ||
              selectedTemplate.template_key,
            meals,
            start_date:
              new Date()
                .toISOString()
                .slice(0, 10),
          }),
        },
      );

      setSuccess(
        "Diet plan assigned successfully.",
      );
    } catch (err) {
      setError(
        err.message ||
          "Unable to assign diet.",
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <section className="staff-page diets-page">
        <div className="staff-state">
          <span className="staff-loader" />

          <p>
            Loading diet builder...
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="staff-page diets-page">
      <header className="staff-page-header">
        <div>
          <p className="staff-eyebrow">
            STAFF — DIET
          </p>

          <h1>FUEL BETTER.</h1>

          <p>
            Start from a calorie-targeted
            template, make member-specific
            changes, then assign.
          </p>
        </div>

        <div className="diet-header-mark">
          NUTRITION
        </div>
      </header>

      {error && (
        <div className="staff-message staff-message-error">
          {error}
        </div>
      )}

      {success && (
        <div className="staff-message staff-message-success">
          {success}
        </div>
      )}

      <div className="diet-builder">
        <aside className="diet-template-panel">
          <div className="diet-template-header">
            <div>
              <p className="staff-eyebrow">
                TEMPLATE LIBRARY
              </p>

              <h2>
                Choose fuel.
              </h2>
            </div>

            <span>
              {templates.length} PLAN
              {templates.length === 1
                ? ""
                : "S"}
            </span>
          </div>

          <div className="diet-template-list">
            {templates.length === 0 ? (
              <div className="diet-empty-library">
                <strong>
                  NO TEMPLATES.
                </strong>

                <p>
                  Create a diet template
                  before assigning a plan.
                </p>
              </div>
            ) : (
              templates.map(
                (template, index) => {
                  const active =
                    selectedTemplate ===
                    template;

                  return (
                    <button
                      type="button"
                      key={
                        template._id ||
                        template.template_key
                      }
                      className={
                        active
                          ? "diet-template active"
                          : "diet-template"
                      }
                      onClick={() =>
                        chooseTemplate(
                          template,
                        )
                      }
                    >
                      <span className="diet-template-index">
                        {String(
                          index + 1,
                        ).padStart(2, "0")}
                      </span>

                      <span className="diet-template-copy">
                        <strong>
                          {template.name ||
                            template.template_key}
                        </strong>

                        <small>
                          {template.meals
                            ?.length ||
                            0}{" "}
                          MEALS
                        </small>
                      </span>

                      <span className="diet-template-calories">
                        {template.calories
                          ? `${template.calories} KCAL`
                          : "CUSTOM"}
                      </span>
                    </button>
                  );
                },
              )
            )}
          </div>
        </aside>

        <main className="diet-builder-main">
          <div className="diet-builder-header">
            <div>
              <p className="staff-eyebrow">
                PLAN BUILDER
              </p>

              <h2>
                {selectedTemplate?.name ||
                  "Select a diet template"}
              </h2>
            </div>

            {selectedTemplate && (
              <button
                type="button"
                className="staff-button staff-button-outline"
                onClick={addMeal}
              >
                + ADD MEAL
              </button>
            )}
          </div>

          {!selectedTemplate ? (
            <div className="diet-placeholder">
              <span className="diet-placeholder-mark">
                /
              </span>

              <strong>
                SELECT A TEMPLATE.
              </strong>

              <p>
                Choose a calorie-targeted
                plan from the library to
                begin member-specific
                editing.
              </p>
            </div>
          ) : (
            <>
              <div className="diet-calorie-hero">
                <div>
                  <span>
                    DAILY TARGET
                  </span>

                  <strong>
                    {selectedTemplate.calories ||
                      "CUSTOM"}
                  </strong>

                  <small>
                    KCAL
                  </small>
                </div>

                <div className="diet-calorie-side">
                  <span>
                    MEALS
                  </span>

                  <strong>
                    {meals.length}
                  </strong>
                </div>
              </div>

              <div className="diet-meal-heading">
                <div>
                  <p className="staff-eyebrow">
                    DAILY MEALS
                  </p>

                  <span>
                    Edit the plan before
                    assigning it to the
                    member.
                  </span>
                </div>
              </div>

              <div className="diet-meal-list">
                {meals.length === 0 ? (
                  <div className="diet-empty-meals">
                    <strong>
                      NO MEALS YET.
                    </strong>

                    <p>
                      Add the first meal to
                      build this member's
                      plan.
                    </p>
                  </div>
                ) : (
                  meals.map(
                    (meal, index) => (
                      <article
                        className="diet-meal-card"
                        key={index}
                      >
                        <div className="diet-meal-number">
                          {String(
                            index + 1,
                          ).padStart(
                            2,
                            "0",
                          )}
                        </div>

                        <div className="diet-meal-content">
                          <div className="diet-meal-inputs">
                            <input
                              value={
                                meal.name ||
                                ""
                              }
                              placeholder="Meal name"
                              onChange={(
                                event,
                              ) =>
                                updateMeal(
                                  index,
                                  "name",
                                  event
                                    .target
                                    .value,
                                )
                              }
                            />

                            <input
                              value={
                                meal.calories ||
                                ""
                              }
                              placeholder="Calories"
                              inputMode="numeric"
                              onChange={(
                                event,
                              ) =>
                                updateMeal(
                                  index,
                                  "calories",
                                  event
                                    .target
                                    .value,
                                )
                              }
                            />
                          </div>

                          <div className="diet-items">
                            {(
                              meal.items ||
                              []
                            ).length ===
                            0 ? (
                              <span className="diet-no-items">
                                NO ITEMS
                              </span>
                            ) : (
                              (
                                meal.items ||
                                []
                              ).map(
                                (
                                  item,
                                  itemIndex,
                                ) => (
                                  <span
                                    key={
                                      itemIndex
                                    }
                                  >
                                    {typeof item ===
                                    "string"
                                      ? item
                                      : item.name}
                                  </span>
                                ),
                              )
                            )}
                          </div>
                        </div>

                        <button
                          type="button"
                          className="diet-remove"
                          onClick={() =>
                            removeMeal(
                              index,
                            )
                          }
                        >
                          REMOVE
                        </button>
                      </article>
                    ),
                  )
                )}
              </div>

              <div className="diet-assignment">
                <div className="diet-assignment-copy">
                  <p className="staff-eyebrow">
                    ASSIGN TO MEMBER
                  </p>

                  <h3>
                    Who is this plan for?
                  </h3>

                  <p>
                    The plan starts today and
                    remains available to the
                    assigned member.
                  </p>
                </div>

                <div className="diet-assignment-controls">
                  <input
                    type="search"
                    placeholder="Search name, ID, phone..."
                    value={memberSearch}
                    onChange={(event) =>
                      setMemberSearch(
                        event.target.value,
                      )
                    }
                  />

                  <select
                    value={selectedMember}
                    onChange={(event) =>
                      setSelectedMember(
                        event.target.value,
                      )
                    }
                  >
                    <option value="">
                      Select active member
                    </option>

                    {filteredMembers.map(
                      (member) => (
                        <option
                          key={
                            member.member_id
                          }
                          value={
                            member.member_id
                          }
                        >
                          {member.name} —{" "}
                          {
                            member.member_id
                          }
                        </option>
                      ),
                    )}
                  </select>
                </div>

                <button
                  type="button"
                  disabled={saving}
                  className="staff-button staff-button-dark diet-assignment-button"
                  onClick={
                    assignDiet
                  }
                >
                  {saving
                    ? "ASSIGNING..."
                    : "ASSIGN DIET"}
                </button>
              </div>
            </>
          )}
        </main>
      </div>
    </section>
  );
}

export default DietsPage;