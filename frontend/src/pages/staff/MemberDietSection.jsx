import { useEffect, useMemo, useState } from "react";

import {
  createDietAssignment,
  getDietAssignments,
  getDietTemplates,
} from "../../api/client";

import "./MemberDietSection.css";

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

function cloneMeals(meals = []) {
  return meals.map((meal) => ({
    ...meal,
    items: (meal.items || []).map(
      (item) => ({
        ...item,
      }),
    ),
  }));
}

function MemberDietSection({ memberId }) {
  const [templates, setTemplates] = useState([]);
  const [assignments, setAssignments] =
    useState([]);

  const [selectedTemplateKey, setSelectedTemplateKey] =
    useState("");

  const [meals, setMeals] = useState([]);

  const [notes, setNotes] = useState("");

  const [loading, setLoading] =
    useState(true);
  const [saving, setSaving] =
    useState(false);

  const [error, setError] =
    useState("");
  const [success, setSuccess] =
    useState("");

  async function loadDiet() {
    try {
      setLoading(true);
      setError("");

      const [
        templateResponse,
        assignmentResponse,
      ] = await Promise.all([
        getDietTemplates(),
        getDietAssignments(),
      ]);

      const nextTemplates =
        normalizeArray(
          templateResponse,
        );

      const allAssignments =
        normalizeArray(
          assignmentResponse,
        );

      const memberAssignments =
        allAssignments.filter(
          (assignment) =>
            String(
              assignment?.member_id,
            ) === String(memberId),
        );

      setTemplates(nextTemplates);
      setAssignments(
        memberAssignments,
      );

      const activeAssignment =
        memberAssignments.find(
          (assignment) =>
            String(
              assignment?.status ||
                "",
            ).toLowerCase() ===
            "active",
        );

      const matchingTemplate =
        nextTemplates.find(
          (template) =>
            template.template_key ===
            activeAssignment?.template_key,
        );

      if (matchingTemplate) {
        setSelectedTemplateKey(
          matchingTemplate.template_key,
        );

        setMeals(
          cloneMeals(
            matchingTemplate.meals,
          ),
        );
      }
    } catch (err) {
      setError(
        err?.message ||
          "We couldn't load this member's diet.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!memberId) {
      return;
    }

    loadDiet();
  }, [memberId]);

  const selectedTemplate = useMemo(
    () =>
      templates.find(
        (template) =>
          template.template_key ===
          selectedTemplateKey,
      ) || null,
    [templates, selectedTemplateKey],
  );

  const activeAssignment =
    assignments.find(
      (assignment) =>
        String(
          assignment?.status || "",
        ).toLowerCase() === "active",
    ) || null;

  function handleTemplateChange(
    event,
  ) {
    const templateKey =
      event.target.value;

    setSelectedTemplateKey(
      templateKey,
    );

    const template =
      templates.find(
        (item) =>
          item.template_key ===
          templateKey,
      );

    setMeals(
      cloneMeals(
        template?.meals || [],
      ),
    );

    setError("");
    setSuccess("");
  }

  function updateMeal(
    mealIndex,
    field,
    value,
  ) {
    setMeals((current) =>
      current.map(
        (meal, index) =>
          index === mealIndex
            ? {
                ...meal,
                [field]: value,
              }
            : meal,
      ),
    );
  }

  function updateMealItem(
    mealIndex,
    itemIndex,
    field,
    value,
  ) {
    setMeals((current) =>
      current.map(
        (meal, currentMealIndex) => {
          if (
            currentMealIndex !==
            mealIndex
          ) {
            return meal;
          }

          return {
            ...meal,
            items: (
              meal.items || []
            ).map(
              (
                item,
                currentItemIndex,
              ) =>
                currentItemIndex ===
                itemIndex
                  ? {
                      ...item,
                      [field]:
                        value,
                    }
                  : item,
            ),
          };
        },
      ),
    );
  }

  function addMeal() {
    setMeals((current) => [
      ...current,
      {
        name: "New Meal",
        meal_type: "custom",
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

  function addMealItem(mealIndex) {
    setMeals((current) =>
      current.map(
        (meal, index) =>
          index === mealIndex
            ? {
                ...meal,
                items: [
                  ...(meal.items || []),
                  {
                    name: "",
                    quantity: "",
                    notes: "",
                  },
                ],
              }
            : meal,
      ),
    );
  }

  function removeMealItem(
    mealIndex,
    itemIndex,
  ) {
    setMeals((current) =>
      current.map(
        (meal, index) =>
          index === mealIndex
            ? {
                ...meal,
                items: (
                  meal.items || []
                ).filter(
                  (
                    _,
                    currentItemIndex,
                  ) =>
                    currentItemIndex !==
                    itemIndex,
                ),
              }
            : meal,
      ),
    );
  }

  async function assignDiet() {
    if (!selectedTemplate) {
      setError(
        "Select a diet template first.",
      );
      return;
    }

    try {
      setSaving(true);
      setError("");
      setSuccess("");

      /*
       * The current backend assignment contract
       * stores the template_key and assigned_date.
       * The editable meal state is therefore kept
       * in the UI for now; the assignment itself
       * references the selected template.
       */
      await createDietAssignment({
        member_id: memberId,
        template_key:
          selectedTemplate.template_key,
        assigned_date: getToday(),
        status: "active",
        notes,
      });

      setSuccess(
        "Diet plan assigned to this member.",
      );

      await loadDiet();
    } catch (err) {
      setError(
        err?.message ||
          "We couldn't assign this diet.",
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <section className="member-diet-section">
        <div className="member-diet-state">
          <span className="staff-loader" />

          <p>
            Loading member diet...
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="member-diet-section">
      <div className="member-profile-section-heading">
        <div>
          <p className="member-profile-eyebrow">
            MEMBER / DIET
          </p>

          <h2>
            FUEL THE PLAN.
          </h2>
        </div>

        <p>
          Choose the calorie-targeted plan
          that should remain associated with
          this member.
        </p>
      </div>

      {error && (
        <div className="member-diet-message member-diet-message-error">
          {error}
        </div>
      )}

      {success && (
        <div className="member-diet-message member-diet-message-success">
          {success}
        </div>
      )}

      <div className="member-diet-current">
        <div>
          <p className="member-profile-eyebrow">
            CURRENT PLAN
          </p>

          <h3>
            {activeAssignment
              ? activeAssignment.template_key
              : "NO ACTIVE DIET"}
          </h3>

          <p>
            {activeAssignment
              ? `Assigned ${formatDate(
                  activeAssignment.assigned_date,
                )}`
              : "No active diet assignment exists for this member."}
          </p>
        </div>

        <div className="member-diet-current-mark">
          {activeAssignment
            ? "ACTIVE"
            : "NOT SET"}
        </div>
      </div>

      <div className="member-diet-selector">
        <div>
          <p className="member-profile-eyebrow">
            PLAN LIBRARY
          </p>

          <h3>
            Choose nutrition.
          </h3>

          <p>
            The member can be moved to
            another reusable diet template
            at any time.
          </p>
        </div>

        <div className="member-diet-selector-controls">
          <select
            value={selectedTemplateKey}
            onChange={
              handleTemplateChange
            }
            disabled={saving}
          >
            <option value="">
              Select diet template
            </option>

            {templates.map(
              (template) => (
                <option
                  key={
                    template.template_key
                  }
                  value={
                    template.template_key
                  }
                >
                  {template.name ||
                    template.template_key}
                </option>
              ),
            )}
          </select>

          <button
            type="button"
            className="member-diet-button member-diet-button-dark"
            onClick={assignDiet}
            disabled={
              saving ||
              !selectedTemplate
            }
          >
            {saving
              ? "ASSIGNING..."
              : "ASSIGN DIET →"}
          </button>
        </div>
      </div>

      {selectedTemplate && (
        <>
          <div className="member-diet-target">
            <div>
              <span>
                DAILY TARGET
              </span>

              <strong>
                {selectedTemplate.target_calories ||
                  "CUSTOM"}
              </strong>

              <small>
                KCAL
              </small>
            </div>

            <div>
              <span>
                MEALS
              </span>

              <strong>
                {meals.length}
              </strong>
            </div>
          </div>

          <div className="member-diet-meals">
            <div className="member-diet-meals-heading">
              <div>
                <p className="member-profile-eyebrow">
                  DAILY MEALS
                </p>

                <h3>
                  {selectedTemplate.name}
                </h3>
              </div>

              <button
                type="button"
                onClick={addMeal}
              >
                + ADD MEAL
              </button>
            </div>

            <div className="member-diet-meal-list">
              {meals.map(
                (meal, mealIndex) => (
                  <article
                    className="member-diet-meal"
                    key={`${mealIndex}-${meal.name}`}
                  >
                    <div className="member-diet-meal-top">
                      <div className="member-diet-meal-number">
                        {String(
                          mealIndex + 1,
                        ).padStart(2, "0")}
                      </div>

                      <input
                        value={
                          meal.name || ""
                        }
                        onChange={(event) =>
                          updateMeal(
                            mealIndex,
                            "name",
                            event.target
                              .value,
                          )
                        }
                      />

                      <button
                        type="button"
                        onClick={() =>
                          removeMeal(
                            mealIndex,
                          )
                        }
                      >
                        REMOVE
                      </button>
                    </div>

                    <div className="member-diet-items">
                      {(
                        meal.items || []
                      ).map(
                        (
                          item,
                          itemIndex,
                        ) => (
                          <div
                            className="member-diet-item"
                            key={`${itemIndex}-${item.name}`}
                          >
                            <input
                              placeholder="Food"
                              value={
                                item.name ||
                                ""
                              }
                              onChange={(
                                event,
                              ) =>
                                updateMealItem(
                                  mealIndex,
                                  itemIndex,
                                  "name",
                                  event
                                    .target
                                    .value,
                                )
                              }
                            />

                            <input
                              placeholder="Quantity"
                              value={
                                item.quantity ||
                                ""
                              }
                              onChange={(
                                event,
                              ) =>
                                updateMealItem(
                                  mealIndex,
                                  itemIndex,
                                  "quantity",
                                  event
                                    .target
                                    .value,
                                )
                              }
                            />

                            <input
                              placeholder="Notes"
                              value={
                                item.notes ||
                                ""
                              }
                              onChange={(
                                event,
                              ) =>
                                updateMealItem(
                                  mealIndex,
                                  itemIndex,
                                  "notes",
                                  event
                                    .target
                                    .value,
                                )
                              }
                            />

                            <button
                              type="button"
                              onClick={() =>
                                removeMealItem(
                                  mealIndex,
                                  itemIndex,
                                )
                              }
                            >
                              ×
                            </button>
                          </div>
                        ),
                      )}

                      <button
                        type="button"
                        className="member-diet-add-item"
                        onClick={() =>
                          addMealItem(
                            mealIndex,
                          )
                        }
                      >
                        + ADD FOOD
                      </button>
                    </div>
                  </article>
                ),
              )}
            </div>
          </div>

          <div className="member-diet-notes">
            <label>
              <span>
                STAFF NOTES
              </span>

              <textarea
                value={notes}
                onChange={(event) =>
                  setNotes(
                    event.target.value,
                  )
                }
                placeholder="Optional notes for this member's diet assignment..."
                rows={4}
              />
            </label>
          </div>
        </>
      )}

      {!selectedTemplate && (
        <div className="member-diet-empty">
          <span>/</span>

          <strong>
            SELECT A DIET TEMPLATE.
          </strong>

          <p>
            Choose one of the existing
            calorie-targeted plans to view
            and prepare the member's nutrition
            plan.
          </p>
        </div>
      )}

      {assignments.length > 0 && (
        <div className="member-diet-history">
          <div>
            <p className="member-profile-eyebrow">
              ASSIGNMENT HISTORY
            </p>

            <h3>
              PREVIOUS DIET PLANS.
            </h3>
          </div>

          <div className="member-diet-history-list">
            {assignments.map(
              (assignment) => (
                <article
                  key={
                    assignment.id ||
                    assignment._id ||
                    `${assignment.template_key}-${assignment.assigned_date}`
                  }
                >
                  <div>
                    <span>
                      PLAN
                    </span>

                    <strong>
                      {
                        assignment.template_key
                      }
                    </strong>
                  </div>

                  <div>
                    <span>
                      ASSIGNED
                    </span>

                    <strong>
                      {formatDate(
                        assignment.assigned_date,
                      )}
                    </strong>
                  </div>

                  <span
                    className={
                      String(
                        assignment.status ||
                          "",
                      ).toLowerCase() ===
                      "active"
                        ? "is-active"
                        : ""
                    }
                  >
                    {String(
                      assignment.status ||
                        "active",
                    ).toUpperCase()}
                  </span>
                </article>
              ),
            )}
          </div>
        </div>
      )}
    </section>
  );
}

export default MemberDietSection;