import { useEffect, useMemo, useState } from "react";

import {
  assignWorkoutTemplate,
  createWorkoutTemplate,
  deleteWorkoutTemplate,
  getMembers,
  getWorkoutTemplates,
  updateWorkoutTemplate,
} from "../../api/client";

import "./WorkoutsPage.css";

const TEMPLATE_LABELS = {
  strength: "Strength",
  weight_loss: "Weight Loss",
  weight_gain: "Weight Gain",
  endurance: "Endurance",
};

const TEMPLATE_DESCRIPTIONS = {
  strength:
    "Progressive resistance training built around strength, control and consistency.",
  weight_loss:
    "Structured training focused on movement, conditioning and sustainable progress.",
  weight_gain:
    "Training designed to support muscle development, progressive overload and recovery.",
  endurance:
    "Conditioning-focused training built around stamina, work capacity and consistency.",
};

const EMPTY_EXERCISE = {
  name: "",
  sets: 3,
  reps: 10,
  weight: "",
};

function getId(item) {
  return (
    item?.id ||
    item?._id ||
    item?.template_id ||
    null
  );
}

function getName(template) {
  return (
    TEMPLATE_LABELS[template?.template_key] ||
    template?.name ||
    "Workout"
  );
}

function normalizeArray(response) {
  if (Array.isArray(response)) {
    return response;
  }

  return (
    response?.value ||
    response?.data ||
    response?.results ||
    []
  );
}

function normalizeExercises(exercises = []) {
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

function WorkoutsPage() {
  const [templates, setTemplates] = useState([]);
  const [members, setMembers] = useState([]);

  const [selectedTemplate, setSelectedTemplate] =
    useState(null);

  const [selectedMember, setSelectedMember] =
    useState("");

  const [memberSearch, setMemberSearch] =
    useState("");

  const [mode, setMode] = useState("view");

  const [templateKey, setTemplateKey] =
    useState("");

  const [templateName, setTemplateName] =
    useState("");

  const [templateDescription, setTemplateDescription] =
    useState("");

  const [exercises, setExercises] = useState([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [assigning, setAssigning] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function load() {
    try {
      setLoading(true);
      setError("");

      const [templateResponse, memberResponse] =
        await Promise.all([
          getWorkoutTemplates(),
          getMembers(),
        ]);

      const nextTemplates =
        normalizeArray(templateResponse);

      const nextMembers =
        normalizeArray(memberResponse);

      setTemplates(nextTemplates);
      setMembers(nextMembers);

      if (nextTemplates.length === 0) {
        setSelectedTemplate(null);
        return;
      }

      const currentId = getId(selectedTemplate);

      const refreshed =
        nextTemplates.find(
          (template) =>
            String(getId(template)) ===
            String(currentId),
        ) || nextTemplates[0];

      setSelectedTemplate(refreshed);
    } catch (err) {
      setError(
        err?.message ||
          "Unable to load workout data.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const activeMembers = useMemo(
    () =>
      members.filter(
        (member) =>
          String(member?.status || "")
            .toLowerCase() === "active",
      ),
    [members],
  );

  const filteredMembers = useMemo(() => {
    const query =
      memberSearch.trim().toLowerCase();

    if (!query) {
      return activeMembers;
    }

    return activeMembers.filter((member) =>
      [
        member?.member_id,
        member?.name,
        member?.phone,
      ]
        .filter(Boolean)
        .some((value) =>
          String(value)
            .toLowerCase()
            .includes(query),
        ),
    );
  }, [activeMembers, memberSearch]);

  function clearMessages() {
    setError("");
    setSuccess("");
  }

  function startCreate() {
    clearMessages();

    setMode("create");
    setSelectedTemplate(null);

    setTemplateKey("");
    setTemplateName("");
    setTemplateDescription("");
    setExercises([]);
  }

  function startEdit(template) {
    clearMessages();

    setMode("edit");
    setSelectedTemplate(template);

    setTemplateKey(
      template?.template_key || "",
    );

    setTemplateName(
      template?.name || "",
    );

    setTemplateDescription(
      template?.description || "",
    );

    setExercises(
      normalizeExercises(
        template?.exercises || [],
      ),
    );
  }

  function cancelEditor() {
    clearMessages();
    setMode("view");

    if (templates.length > 0) {
      const currentId = getId(selectedTemplate);

      setSelectedTemplate(
        templates.find(
          (template) =>
            String(getId(template)) ===
            String(currentId),
        ) || templates[0],
      );
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
                    ? Math.max(
                        1,
                        Number(value) || 1,
                      )
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
        ...EMPTY_EXERCISE,
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

  function validateTemplate() {
    if (!templateKey.trim()) {
      return "Template key is required.";
    }

    if (!templateName.trim()) {
      return "Template name is required.";
    }

    if (exercises.length === 0) {
      return "Add at least one exercise.";
    }

    if (
      exercises.some(
        (exercise) =>
          !exercise.name.trim(),
      )
    ) {
      return "Every exercise needs a name.";
    }

    return "";
  }

  async function saveTemplate() {
    const validationError =
      validateTemplate();

    if (validationError) {
      setError(validationError);
      return;
    }

    try {
      setSaving(true);
      clearMessages();

      const payload = {
        template_key:
          templateKey.trim().toLowerCase(),
        name: templateName.trim(),
        description:
          templateDescription.trim(),
        exercises: exercises.map(
          (exercise, index) => ({
            name: exercise.name.trim(),
            sets:
              Number(exercise.sets) || 1,
            reps:
              Number(exercise.reps) || 1,
            weight:
              exercise.weight === ""
                ? null
                : exercise.weight,
            order: index,
          }),
        ),
      };

      let saved;

      if (
        mode === "edit" &&
        selectedTemplate
      ) {
        saved =
          await updateWorkoutTemplate(
            getId(selectedTemplate),
            payload,
          );

        setSuccess(
          "Workout template updated.",
        );
      } else {
        saved =
          await createWorkoutTemplate(
            payload,
          );

        setSuccess(
          "Workout template created.",
        );
      }

      const response =
        await getWorkoutTemplates();

      const nextTemplates =
        normalizeArray(response);

      setTemplates(nextTemplates);

      const savedId = getId(saved);

      setSelectedTemplate(
        nextTemplates.find(
          (template) =>
            String(getId(template)) ===
            String(savedId),
        ) ||
          nextTemplates.find(
            (template) =>
              template.template_key ===
              payload.template_key,
          ) ||
          nextTemplates[0] ||
          null,
      );

      setMode("view");
    } catch (err) {
      setError(
        err?.message ||
          "Unable to save workout template.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function deleteTemplate() {
    if (!selectedTemplate) {
      return;
    }

    const confirmed =
      window.confirm(
        `Delete "${getName(
          selectedTemplate,
        )}"?`,
      );

    if (!confirmed) {
      return;
    }

    try {
      setSaving(true);
      clearMessages();

      await deleteWorkoutTemplate(
        getId(selectedTemplate),
      );

      setSuccess(
        "Workout template deleted.",
      );

      const response =
        await getWorkoutTemplates();

      const nextTemplates =
        normalizeArray(response);

      setTemplates(nextTemplates);
      setSelectedTemplate(
        nextTemplates[0] || null,
      );
    } catch (err) {
      setError(
        err?.message ||
          "Unable to delete workout template.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function assignTemplate() {
    if (!selectedTemplate) {
      setError(
        "Select a workout template first.",
      );
      return;
    }

    if (!selectedMember) {
      setError(
        "Select a member before assigning.",
      );
      return;
    }

    try {
      setAssigning(true);
      clearMessages();

      const member =
        activeMembers.find(
          (item) =>
            item.member_id ===
            selectedMember,
        );

      await assignWorkoutTemplate(
        selectedMember,
        getId(selectedTemplate),
      );

      setSuccess(
        `${getName(
          selectedTemplate,
        )} is now the default plan for ${
          member?.name ||
          selectedMember
        }.`,
      );
    } catch (err) {
      setError(
        err?.message ||
          "Unable to assign workout template.",
      );
    } finally {
      setAssigning(false);
    }
  }

  if (loading) {
    return (
      <section className="staff-page workouts-page">
        <div className="staff-state">
          <span className="staff-loader" />
          <p>
            Loading workout library...
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="staff-page workouts-page">
      <header className="staff-page-header workouts-page-header">
        <div>
          <p className="staff-eyebrow">
            STAFF / WORKOUTS
          </p>

          <h1>
            BUILD
            <br />
            BETTER.
          </h1>

          <p>
            Build reusable training plans,
            assign them to members and manage
            their daily workouts from the
            member profile.
          </p>
        </div>

        <button
          type="button"
          className="staff-button staff-button-dark"
          onClick={startCreate}
          disabled={saving}
        >
          + CREATE TEMPLATE
        </button>
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

      <div className="workout-builder">
        <aside className="workout-library">
          <div className="workout-library-header">
            <div>
              <p className="staff-eyebrow">
                TEMPLATE LIBRARY
              </p>

              <h2>
                CHOOSE
                <br />
                A PLAN.
              </h2>
            </div>

            <span className="workout-library-count">
              {templates.length}
            </span>
          </div>

          <div className="workout-template-list">
            {templates.length === 0 ? (
              <div className="workout-library-empty">
                <strong>
                  NO TEMPLATES.
                </strong>

                <p>
                  Create the first reusable
                  workout plan.
                </p>
              </div>
            ) : (
              templates.map(
                (template, index) => {
                  const active =
                    mode === "view" &&
                    String(
                      getId(
                        selectedTemplate,
                      ),
                    ) ===
                      String(
                        getId(template),
                      );

                  return (
                    <button
                      type="button"
                      key={
                        getId(template) ||
                        index
                      }
                      className={`workout-template ${
                        active
                          ? "workout-template-active"
                          : ""
                      }`}
                      onClick={() => {
                        clearMessages();
                        setMode("view");
                        setSelectedTemplate(
                          template,
                        );
                      }}
                    >
                      <span className="workout-template-index">
                        {String(
                          index + 1,
                        ).padStart(2, "0")}
                      </span>

                      <span className="workout-template-copy">
                        <strong>
                          {getName(template)}
                        </strong>

                        <small>
                          {template
                            ?.exercises
                            ?.length || 0}{" "}
                          EXERCISES
                        </small>
                      </span>

                      <span className="workout-template-arrow">
                        →
                      </span>
                    </button>
                  );
                },
              )
            )}
          </div>
        </aside>

        <main className="workout-builder-main">
          {mode === "create" ||
          mode === "edit" ? (
            <section className="workout-editor">
              <div className="workout-builder-header">
                <div>
                  <p className="staff-eyebrow">
                    {mode === "edit"
                      ? "EDIT TEMPLATE"
                      : "NEW TEMPLATE"}
                  </p>

                  <h2>
                    {mode === "edit"
                      ? "REFINE THE PLAN."
                      : "CREATE THE PLAN."}
                  </h2>
                </div>

                <button
                  type="button"
                  className="staff-button staff-button-outline"
                  onClick={cancelEditor}
                  disabled={saving}
                >
                  CANCEL
                </button>
              </div>

              <div className="workout-editor-fields">
                <label>
                  <span>
                    TEMPLATE KEY
                  </span>

                  <input
                    value={templateKey}
                    onChange={(event) =>
                      setTemplateKey(
                        event.target.value,
                      )
                    }
                    placeholder="strength"
                    disabled={
                      mode === "edit" ||
                      saving
                    }
                  />
                </label>

                <label>
                  <span>NAME</span>

                  <input
                    value={templateName}
                    onChange={(event) =>
                      setTemplateName(
                        event.target.value,
                      )
                    }
                    placeholder="Strength"
                    disabled={saving}
                  />
                </label>

                <label className="workout-editor-description">
                  <span>
                    DESCRIPTION
                  </span>

                  <textarea
                    value={
                      templateDescription
                    }
                    onChange={(event) =>
                      setTemplateDescription(
                        event.target.value,
                      )
                    }
                    rows={3}
                    placeholder="Describe this training plan."
                    disabled={saving}
                  />
                </label>
              </div>

              <div className="workout-section-label">
                <p className="staff-eyebrow">
                  EXERCISES
                </p>

                <button
                  type="button"
                  className="staff-button staff-button-outline"
                  onClick={addExercise}
                  disabled={saving}
                >
                  + ADD EXERCISE
                </button>
              </div>

              <div className="workout-editor-exercises">
                {exercises.length === 0 ? (
                  <div className="workout-exercises-empty">
                    Add real exercises to make
                    this template usable.
                  </div>
                ) : (
                  exercises.map(
                    (exercise, index) => (
                      <article
                        className="workout-editor-exercise"
                        key={`${index}-${exercise.name}`}
                      >
                        <strong>
                          {String(
                            index + 1,
                          ).padStart(2, "0")}
                        </strong>

                        <input
                          value={
                            exercise.name
                          }
                          placeholder="Exercise name"
                          onChange={(event) =>
                            updateExercise(
                              index,
                              "name",
                              event.target
                                .value,
                            )
                          }
                          disabled={saving}
                        />

                        <input
                          type="number"
                          min="1"
                          value={
                            exercise.sets
                          }
                          onChange={(event) =>
                            updateExercise(
                              index,
                              "sets",
                              event.target
                                .value,
                            )
                          }
                          disabled={saving}
                        />

                        <input
                          type="number"
                          min="1"
                          value={
                            exercise.reps
                          }
                          onChange={(event) =>
                            updateExercise(
                              index,
                              "reps",
                              event.target
                                .value,
                            )
                          }
                          disabled={saving}
                        />

                        <input
                          value={
                            exercise.weight
                          }
                          placeholder="Load"
                          onChange={(event) =>
                            updateExercise(
                              index,
                              "weight",
                              event.target
                                .value,
                            )
                          }
                          disabled={saving}
                        />

                        <button
                          type="button"
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
              </div>

              <div className="workout-editor-footer">
                <button
                  type="button"
                  className="staff-button staff-button-dark"
                  onClick={saveTemplate}
                  disabled={saving}
                >
                  {saving
                    ? "SAVING..."
                    : mode === "edit"
                      ? "SAVE TEMPLATE →"
                      : "CREATE TEMPLATE →"}
                </button>
              </div>
            </section>
          ) : selectedTemplate ? (
            <>
              <header className="workout-builder-header">
                <div>
                  <p className="staff-eyebrow">
                    SELECTED PLAN
                  </p>

                  <h2>
                    {getName(
                      selectedTemplate,
                    )}
                    .
                  </h2>

                  <p className="workout-builder-description">
                    {selectedTemplate
                      ?.description ||
                      TEMPLATE_DESCRIPTIONS[
                        selectedTemplate
                          ?.template_key
                      ] ||
                      "Reusable workout template."}
                  </p>
                </div>

                <div className="workout-builder-actions">
                  <button
                    type="button"
                    className="staff-button staff-button-outline"
                    onClick={() =>
                      startEdit(
                        selectedTemplate,
                      )
                    }
                  >
                    EDIT
                  </button>

                  <button
                    type="button"
                    className="staff-button staff-button-danger"
                    onClick={
                      deleteTemplate
                    }
                    disabled={saving}
                  >
                    DELETE
                  </button>
                </div>
              </header>

              <section className="workout-exercise-section">
                <div className="workout-section-label">
                  <p className="staff-eyebrow">
                    WORKOUT CONTENT
                  </p>

                  <span>
                    {selectedTemplate
                      ?.exercises
                      ?.length || 0}{" "}
                    MOVEMENTS
                  </span>
                </div>

                <div className="workout-exercises">
                  {!selectedTemplate
                    ?.exercises
                    ?.length ? (
                    <div className="workout-exercises-empty">
                      This template has no
                      exercises. Edit it and
                      add real movements.
                    </div>
                  ) : (
                    selectedTemplate.exercises.map(
                      (exercise, index) => (
                        <article
                          className="workout-exercise"
                          key={`${exercise?.name}-${index}`}
                        >
                          <span className="workout-order">
                            {String(
                              index + 1,
                            ).padStart(2, "0")}
                          </span>

                          <div className="workout-exercise-main">
                            <strong>
                              {exercise?.name ||
                                "Unnamed exercise"}
                            </strong>

                            <span>
                              {exercise?.sets ||
                                "—"}{" "}
                              SETS ×{" "}
                              {exercise?.reps ||
                                "—"}{" "}
                              REPS
                            </span>
                          </div>

                          <div className="workout-exercise-load">
                            <span>
                              LOAD
                            </span>

                            <strong>
                              {exercise?.weight ||
                                "BODYWEIGHT"}
                            </strong>
                          </div>
                        </article>
                      ),
                    )
                  )}
                </div>
              </section>

              <section className="workout-assignment">
                <div className="workout-assignment-heading">
                  <div>
                    <p className="staff-eyebrow">
                      DEFAULT PLAN
                    </p>

                    <h3>
                      PUT THE PLAN
                      <br />
                      INTO ACTION.
                    </h3>
                  </div>

                  <span>
                    {activeMembers.length} ACTIVE
                    MEMBERS
                  </span>
                </div>

                <div className="workout-assignment-controls">
                  <label>
                    <span>
                      FIND MEMBER
                    </span>

                    <input
                      type="search"
                      placeholder="Name, ID or phone..."
                      value={
                        memberSearch
                      }
                      onChange={(event) =>
                        setMemberSearch(
                          event.target.value,
                        )
                      }
                    />
                  </label>

                  <label>
                    <span>
                      ACTIVE MEMBER
                    </span>

                    <select
                      value={
                        selectedMember
                      }
                      onChange={(event) =>
                        setSelectedMember(
                          event.target.value,
                        )
                      }
                      disabled={assigning}
                    >
                      <option value="">
                        Select member
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
                            {member.name} ·{" "}
                            {
                              member.member_id
                            }
                          </option>
                        ),
                      )}
                    </select>
                  </label>

                  <button
                    type="button"
                    className="staff-button staff-button-dark"
                    onClick={
                      assignTemplate
                    }
                    disabled={
                      assigning ||
                      !selectedMember
                    }
                  >
                    {assigning
                      ? "ASSIGNING..."
                      : "ASSIGN DEFAULT PLAN →"}
                  </button>
                </div>

                <div className="workout-assignment-note">
                  Changing the default plan
                  affects future daily workout
                  generation. Existing daily
                  workouts remain independent
                  history snapshots.
                </div>
              </section>
            </>
          ) : (
            <div className="workout-library-empty workout-library-empty-large">
              <strong>
                READY TO BUILD.
              </strong>

              <p>
                Create a template or select a
                plan from the library.
              </p>
            </div>
          )}
        </main>
      </div>
    </section>
  );
}

export default WorkoutsPage;