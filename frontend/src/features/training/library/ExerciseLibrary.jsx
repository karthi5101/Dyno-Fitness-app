import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import { apiRequest } from "../../../api/client";

import "./ExerciseLibrary.css";

const MUSCLE_OPTIONS = [
  "abdominals",
  "biceps",
  "chest",
  "forearms",
  "glutes",
  "hamstrings",
  "lats",
  "lower back",
  "middle back",
  "quadriceps",
  "shoulders",
  "traps",
  "triceps",
];

const EQUIPMENT_OPTIONS = [
  "body only",
  "barbell",
  "dumbbell",
  "cable",
  "machine",
  "kettlebells",
  "bands",
  "e-z curl bar",
  "exercise ball",
  "medicine ball",
  "other",
];

const LEVEL_OPTIONS = [
  "beginner",
  "intermediate",
  "expert",
];

const CATEGORY_OPTIONS = [
  "strength",
  "cardio",
  "stretching",
  "plyometrics",
  "powerlifting",
  "olympic weightlifting",
  "strongman",
];

const EMPTY_CUSTOM = {
  name: "",
  primary_muscles: "",
  secondary_muscles: "",
  equipment: "body only",
  level: "beginner",
  category: "strength",
  tracking_type: "reps",
  instructions: "",
};

function splitList(value) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function splitInstructions(value) {
  return String(value || "")
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
}

function FilterRow({
  label,
  options,
  value,
  onChange,
}) {
  return (
    <div className="trn-filter-row">
      <span className="trn-filter-label">
        {label}
      </span>
      <div className="trn-chip-row">
        <button
          type="button"
          className={
            value
              ? "trn-chip"
              : "trn-chip trn-chip-active"
          }
          onClick={() => onChange("")}
          aria-pressed={!value}
        >
          ALL
        </button>
        {options.map((option) => (
          <button
            type="button"
            key={option}
            className={
              value === option
                ? "trn-chip trn-chip-active"
                : "trn-chip"
            }
            onClick={() => onChange(option)}
            aria-pressed={value === option}
          >
            {option}
          </button>
        ))}
      </div>
    </div>
  );
}

function ExerciseThumb({ exercise }) {
  if (!exercise?.image_url) {
    return (
      <span className="trn-thumb trn-thumb-placeholder">
        {exercise?.name?.slice(0, 1) || "?"}
      </span>
    );
  }

  return (
    <img
      className="trn-thumb"
      src={exercise.image_url}
      alt=""
      loading="lazy"
    />
  );
}

function ExerciseLibrary({
  readOnly = false,
  title = "EXERCISE LIBRARY",
  eyebrow = "TRAINING",
}) {
  const [query, setQuery] = useState("");
  const [muscle, setMuscle] = useState("");
  const [equipment, setEquipment] = useState("");
  const [level, setLevel] = useState("");
  const [exercises, setExercises] = useState([]);
  const [nextCursor, setNextCursor] = useState(null);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [showCustom, setShowCustom] = useState(false);
  const [custom, setCustom] = useState(EMPTY_CUSTOM);
  const [saving, setSaving] = useState(false);
  const requestId = useRef(0);

  const load = useCallback(
    async (cursor = null, append = false) => {
      const currentRequest = requestId.current + 1;
      requestId.current = currentRequest;

      if (append) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }

      setError("");

      try {
        const params = new URLSearchParams();

        if (query.trim()) {
          params.set("q", query.trim());
        }

        if (muscle) {
          params.set("muscle", muscle);
        }

        if (equipment) {
          params.set("equipment", equipment);
        }

        if (level) {
          params.set("level", level);
        }

        params.set("limit", "20");

        if (cursor) {
          params.set("cursor", cursor);
        }

        const data = await apiRequest(
          `/training/exercises/?${params.toString()}`,
        );

        if (requestId.current !== currentRequest) {
          return;
        }

        const results = Array.isArray(data?.results)
          ? data.results
          : [];

        setExercises((current) =>
          append ? [...current, ...results] : results,
        );
        setNextCursor(data?.next_cursor || null);

        if (!append) {
          setSelected((current) => {
            const currentId = current?.id;

            return (
              results.find(
                (item) => item.id === currentId,
              ) ||
              results[0] ||
              null
            );
          });
        }
      } catch (err) {
        if (requestId.current === currentRequest) {
          setError(
            err?.message ||
              "Unable to load the exercise library.",
          );
        }
      } finally {
        if (requestId.current === currentRequest) {
          setLoading(false);
          setLoadingMore(false);
        }
      }
    },
    [query, muscle, equipment, level],
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      load();
    }, 300);

    return () => clearTimeout(timer);
  }, [load]);

  function updateCustom(field, value) {
    setCustom((current) => ({
      ...current,
      [field]: value,
    }));
  }

  async function submitCustom(event) {
    event.preventDefault();
    setSaving(true);
    setError("");

    try {
      const payload = {
        name: custom.name.trim(),
        primary_muscles: splitList(
          custom.primary_muscles,
        ),
        secondary_muscles: splitList(
          custom.secondary_muscles,
        ),
        equipment: custom.equipment,
        level: custom.level,
        category: custom.category,
        tracking_type: custom.tracking_type,
        instructions: splitInstructions(
          custom.instructions,
        ),
      };

      const created = await apiRequest(
        "/training/exercises/",
        {
          method: "POST",
          body: JSON.stringify(payload),
        },
      );

      setShowCustom(false);
      setCustom(EMPTY_CUSTOM);
      await load();
      setSelected(created);
    } catch (err) {
      setError(
        err?.message ||
          "Unable to create the custom exercise.",
      );
    } finally {
      setSaving(false);
    }
  }

  const selectedName =
    selected?.name || "SELECT AN EXERCISE";

  return (
    <section className="trn-library">
      <header className="trn-library-header">
        <div>
          <p className="trn-eyebrow">{eyebrow}</p>
          <h2>{title}</h2>
          <p className="trn-library-intro">
            Browse the movement library, filter by
            muscle, equipment or level, and open a
            movement for coaching detail.
          </p>
        </div>

        {!readOnly && (
          <button
            type="button"
            className="trn-primary-button"
            onClick={() => setShowCustom((current) => !current)}
          >
            {showCustom ? "CLOSE" : "+ CUSTOM EXERCISE"}
          </button>
        )}
      </header>

      {showCustom && !readOnly && (
        <form
          className="trn-custom-panel"
          onSubmit={submitCustom}
        >
          <div className="trn-custom-heading">
            <div>
              <p className="trn-eyebrow">STAFF ONLY</p>
              <h3>ADD CUSTOM EXERCISE</h3>
            </div>
            <span className="trn-custom-note">
              SYSTEM LIBRARY ROWS STAY READ-ONLY
            </span>
          </div>

          <div className="trn-custom-grid">
            <label>
              <span>NAME</span>
              <input
                value={custom.name}
                onChange={(event) =>
                  updateCustom(
                    "name",
                    event.target.value,
                  )
                }
                required
                maxLength={150}
              />
            </label>

            <label>
              <span>EQUIPMENT</span>
              <select
                value={custom.equipment}
                onChange={(event) =>
                  updateCustom(
                    "equipment",
                    event.target.value,
                  )
                }
              >
                {EQUIPMENT_OPTIONS.map((option) => (
                  <option
                    key={option}
                    value={option}
                  >
                    {option}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span>LEVEL</span>
              <select
                value={custom.level}
                onChange={(event) =>
                  updateCustom(
                    "level",
                    event.target.value,
                  )
                }
              >
                {LEVEL_OPTIONS.map((option) => (
                  <option
                    key={option}
                    value={option}
                  >
                    {option}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span>CATEGORY</span>
              <select
                value={custom.category}
                onChange={(event) =>
                  updateCustom(
                    "category",
                    event.target.value,
                  )
                }
              >
                {CATEGORY_OPTIONS.map((option) => (
                  <option
                    key={option}
                    value={option}
                  >
                    {option}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span>TRACKING</span>
              <select
                value={custom.tracking_type}
                onChange={(event) =>
                  updateCustom(
                    "tracking_type",
                    event.target.value,
                  )
                }
              >
                <option value="weight_reps">
                  WEIGHT + REPS
                </option>
                <option value="reps">REPS</option>
                <option value="time">TIME</option>
              </select>
            </label>

            <label>
              <span>PRIMARY MUSCLES</span>
              <input
                value={custom.primary_muscles}
                onChange={(event) =>
                  updateCustom(
                    "primary_muscles",
                    event.target.value,
                  )
                }
                placeholder="chest, triceps"
              />
            </label>

            <label>
              <span>SECONDARY MUSCLES</span>
              <input
                value={custom.secondary_muscles}
                onChange={(event) =>
                  updateCustom(
                    "secondary_muscles",
                    event.target.value,
                  )
                }
                placeholder="shoulders"
              />
            </label>

            <label className="trn-custom-wide">
              <span>INSTRUCTIONS</span>
              <textarea
                value={custom.instructions}
                onChange={(event) =>
                  updateCustom(
                    "instructions",
                    event.target.value,
                  )
                }
                rows={4}
                placeholder="One instruction per line."
              />
            </label>
          </div>

          <div className="trn-custom-actions">
            <button
              type="button"
              className="trn-secondary-button"
              onClick={() => setShowCustom(false)}
            >
              CANCEL
            </button>
            <button
              type="submit"
              className="trn-primary-button"
              disabled={saving}
            >
              {saving ? "SAVING..." : "SAVE EXERCISE"}
            </button>
          </div>
        </form>
      )}

      <div className="trn-library-toolbar">
        <label className="trn-search">
          <span className="trn-search-label">
            SEARCH
          </span>
          <input
            value={query}
            onChange={(event) =>
              setQuery(event.target.value)
            }
            placeholder="SEARCH EXERCISES"
            type="search"
          />
        </label>
        <span className="trn-result-count">
          {loading
            ? "LOADING"
            : `${exercises.length} SHOWN`}
        </span>
      </div>

      <div className="trn-filter-rows">
        <FilterRow
          label="MUSCLE"
          options={MUSCLE_OPTIONS}
          value={muscle}
          onChange={setMuscle}
        />
        <FilterRow
          label="EQUIPMENT"
          options={EQUIPMENT_OPTIONS}
          value={equipment}
          onChange={setEquipment}
        />
        <FilterRow
          label="LEVEL"
          options={LEVEL_OPTIONS}
          value={level}
          onChange={setLevel}
        />
      </div>

      {error && (
        <p className="trn-error" role="alert">
          {error}
        </p>
      )}

      <div className="trn-library-grid">
        <div className="trn-exercise-list">
          {loading && (
            <div className="trn-library-state">
              <strong>LOADING LIBRARY</strong>
              <p>Fetching movement data.</p>
            </div>
          )}

          {!loading && exercises.length === 0 && (
            <div className="trn-library-state">
              <strong>NO EXERCISES FOUND</strong>
              <p>
                Adjust the search or clear a filter.
              </p>
            </div>
          )}

          {!loading &&
            exercises.map((exercise) => (
              <button
                type="button"
                key={exercise.id}
                className={
                  selected?.id === exercise.id
                    ? "trn-exercise-row trn-exercise-row-active"
                    : "trn-exercise-row"
                }
                onClick={() => setSelected(exercise)}
              >
                <ExerciseThumb exercise={exercise} />
                <span className="trn-exercise-copy">
                  <strong>{exercise.name}</strong>
                  <small>
                    {exercise.primary_muscles?.join(
                      " · ",
                    ) || "FULL BODY"}
                  </small>
                </span>
                <span className="trn-exercise-arrow">
                  →
                </span>
              </button>
            ))}

          {!loading && nextCursor && (
            <button
              type="button"
              className="trn-load-more"
              onClick={() => load(nextCursor, true)}
              disabled={loadingMore}
            >
              {loadingMore
                ? "LOADING..."
                : "LOAD MORE EXERCISES"}
            </button>
          )}
        </div>

        <aside className="trn-exercise-detail">
          {selected ? (
            <>
              {selected.image_url ? (
                <img
                  className="trn-detail-image"
                  src={selected.image_url}
                  alt={selected.name}
                />
              ) : (
                <div className="trn-detail-placeholder">
                  NO IMAGE
                </div>
              )}

              <p className="trn-eyebrow">
                {selected.is_custom
                  ? "CUSTOM EXERCISE"
                  : "LIBRARY EXERCISE"}
              </p>
              <h3>{selectedName}</h3>

              <div className="trn-detail-tags">
                {[
                  selected.category,
                  selected.equipment,
                  selected.level,
                ]
                  .filter(Boolean)
                  .map((tag) => (
                    <span key={tag}>{tag}</span>
                  ))}
              </div>

              <dl className="trn-detail-facts">
                <div>
                  <dt>TRACKING</dt>
                  <dd>
                    {selected.tracking_type?.replace(
                      "_",
                      " ",
                    )}
                  </dd>
                </div>
                <div>
                  <dt>PRIMARY</dt>
                  <dd>
                    {selected.primary_muscles?.join(
                      ", ",
                    ) || "—"}
                  </dd>
                </div>
                <div>
                  <dt>SECONDARY</dt>
                  <dd>
                    {selected.secondary_muscles?.join(
                      ", ",
                    ) || "—"}
                  </dd>
                </div>
              </dl>

              <div className="trn-instructions">
                <h4>HOW TO PERFORM</h4>
                {selected.instructions?.length ? (
                  <ol>
                    {selected.instructions.map(
                      (instruction, index) => (
                        <li
                          key={`${index}-${instruction}`}
                        >
                          {instruction}
                        </li>
                      ),
                    )}
                  </ol>
                ) : (
                  <p>
                    No instructions have been added
                    yet.
                  </p>
                )}
              </div>
            </>
          ) : (
            <div className="trn-detail-empty">
              <strong>SELECT A MOVEMENT</strong>
              <p>
                Choose an exercise from the library
                to see coaching detail.
              </p>
            </div>
          )}
        </aside>
      </div>
    </section>
  );
}

export default ExerciseLibrary;
