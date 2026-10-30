import { useEffect, useMemo, useState } from "react";

import {
  getMember,
  uploadTransformationImage,
} from "../../api/client";

import "./ProgressPage.css";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  "http://127.0.0.1:8000/api";

const ACCESS_TOKEN_KEY = "dyno_access_token";

function getAccessToken() {
  return localStorage.getItem(ACCESS_TOKEN_KEY) || "";
}

async function transformationRequest(endpoint, options = {}) {
  const token = getAccessToken();

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token
        ? {
            Authorization: `Bearer ${token}`,
          }
        : {}),
      ...(options.headers || {}),
    },
  });

  let data = null;

  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    const detail =
      data?.detail ||
      data?.message ||
      Object.values(data || {})
        .flat()
        .find((value) => typeof value === "string") ||
      "Unable to complete the transformation request.";

    throw new Error(detail);
  }

  return data;
}

async function getTransformations() {
  return transformationRequest("/transformations/");
}

async function createTransformation(data) {
  return transformationRequest("/transformations/", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

async function updateTransformation(transformationId, data) {
  return transformationRequest(
    `/transformations/record/${encodeURIComponent(transformationId)}/`,
    {
      method: "PATCH",
      body: JSON.stringify(data),
    },
  );
}

async function deleteTransformation(transformationId) {
  return transformationRequest(
    `/transformations/record/${encodeURIComponent(transformationId)}/`,
    {
      method: "DELETE",
    },
  );
}

function getTransformationId(record) {
  return (
    record?.transformation_id ||
    record?.id ||
    record?._id ||
    `${record?.member_id}-${record?.week_number}`
  );
}

function getWeek(record) {
  return record?.week_number ?? record?.week ?? "—";
}

function getWeight(record) {
  return record?.weight_kg ?? record?.weight ?? null;
}

function getImageUrl(record) {
  return record?.image_url || record?.image || "";
}

function getRecordedDate(record) {
  return record?.recorded_date || record?.date || "";
}

function getNotes(record) {
  return record?.notes || "";
}

function formatDate(value) {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatWeight(value) {
  if (value === null || value === undefined || value === "") {
    return "—";
  }

  const numericValue = Number(value);

  if (Number.isNaN(numericValue)) {
    return value;
  }

  return Number.isInteger(numericValue)
    ? String(numericValue)
    : numericValue.toFixed(2);
}

function getInitials(name = "") {
  return (
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join("") || "M"
  );
}

function getToday() {
  const date = new Date();

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getNextWeek(records) {
  if (!records.length) {
    return 1;
  }

  const highestWeek = Math.max(
    ...records.map((record) => Number(getWeek(record)) || 0),
  );

  return highestWeek + 1;
}

function MemberProgressSection({
  memberId,
  member: memberProp = null,
  embedded = false,
  showHeader = true,
}) {
  const [memberState, setMemberState] = useState(memberProp);
  const member = memberProp || memberState;
  const [transformations, setTransformations] = useState([]);

  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);

  const [error, setError] = useState("");

  const [formOpen, setFormOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [imageFile, setImageFile] = useState(null);
  const [imageDragActive, setImageDragActive] =
    useState(false);

  const [formData, setFormData] = useState({
    week_number: "",
    recorded_date: getToday(),
    weight_kg: "",
    image_url: "",
    notes: "",
  });

  async function loadProgress() {
    try {
      const transformationsData = await getTransformations();

      setTransformations(
        Array.isArray(transformationsData) ? transformationsData : [],
      );
      setError("");
    } catch (err) {
      setError(err?.message || "Unable to load progress.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;

    getTransformations()
      .then((transformationsData) => {
        if (cancelled) {
          return;
        }

        setTransformations(
          Array.isArray(transformationsData)
            ? transformationsData
            : [],
        );
        setError("");
      })
      .catch((err) => {
        if (!cancelled) {
          setError(
            err?.message || "Unable to load progress.",
          );
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (memberProp || !memberId) {
      return;
    }

    let cancelled = false;

    getMember(memberId)
      .then((response) => {
        if (cancelled) {
          return;
        }

        const normalized =
          response?.value || response?.data || response;

        if (normalized && typeof normalized === "object") {
          setMemberState(normalized);
        }
      })
      .catch(() => {
        // Keep the member ID as a fallback label.
      });

    return () => {
      cancelled = true;
    };
  }, [memberId, memberProp]);

  const selectedRecords = useMemo(() => {
    if (!memberId) {
      return [];
    }

    return transformations
      .filter((record) => String(record?.member_id) === String(memberId))
      .sort((a, b) => {
        const weekDifference =
          Number(getWeek(b) || 0) - Number(getWeek(a) || 0);

        if (weekDifference !== 0) {
          return weekDifference;
        }

        return (
          new Date(getRecordedDate(b) || 0).getTime() -
          new Date(getRecordedDate(a) || 0).getTime()
        );
      });
  }, [memberId, transformations]);

  const latestRecord = selectedRecords[0] || null;
  const earliestRecord = selectedRecords.length > 0 ? selectedRecords[selectedRecords.length - 1] : null;

  const latestWeight = getWeight(latestRecord);
  const startingWeight = getWeight(earliestRecord);

  const weightChange =
    latestWeight !== null &&
    latestWeight !== undefined &&
    startingWeight !== null &&
    startingWeight !== undefined
      ? Number(latestWeight) - Number(startingWeight)
      : null;

  function openCreateForm() {
    if (!memberId) {
      return;
    }

    setEditingRecord(null);
    setFormError("");
    setImageFile(null);

    setFormData({
      week_number: String(getNextWeek(selectedRecords)),
      recorded_date: getToday(),
      weight_kg: "",
      image_url: "",
      notes: "",
    });

    setFormOpen(true);
  }

  function openEditForm(record) {
    setEditingRecord(record);
    setFormError("");
    setImageFile(null);

    setFormData({
      week_number: String(getWeek(record) === "—" ? "" : getWeek(record)),
      recorded_date: getRecordedDate(record)
        ? String(getRecordedDate(record)).slice(0, 10)
        : getToday(),
      weight_kg: getWeight(record) ?? "",
      image_url: getImageUrl(record),
      notes: getNotes(record),
    });

    setFormOpen(true);
  }

  function closeForm() {
    if (formSubmitting) {
      return;
    }

    setFormOpen(false);
    setEditingRecord(null);
    setFormError("");
    setImageFile(null);
  }

  function handleImageFile(file) {
    if (!file) {
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setFormError("Progress images must be 10 MB or smaller.");
      return;
    }

    setImageFile(file);
    setFormError("");
  }

  function handleImageDrop(event) {
    event.preventDefault();
    setImageDragActive(false);
    handleImageFile(event.dataTransfer.files?.[0]);
  }

  function handleFormChange(event) {
    const { name, value } = event.target;

    setFormData((current) => ({
      ...current,
      [name]: value,
    }));
  }

  async function handleFormSubmit(event) {
    event.preventDefault();

    if (!memberId) {
      return;
    }

    setFormSubmitting(true);
    setFormError("");

    try {
      const payload = {
        member_id: memberId,
        week_number: Number(formData.week_number),
        recorded_date: formData.recorded_date,
        weight_kg: Number(formData.weight_kg),
        notes: formData.notes.trim(),
      };

      if (!payload.week_number || payload.week_number < 1) {
        throw new Error("Week number must be at least 1.");
      }

      if (!payload.recorded_date) {
        throw new Error("Recorded date is required.");
      }

      if (
        !formData.weight_kg ||
        Number.isNaN(payload.weight_kg) ||
        payload.weight_kg <= 0
      ) {
        throw new Error("Enter a valid weight.");
      }

      let saved;

      try {
        saved = editingRecord
          ? await updateTransformation(
              getTransformationId(editingRecord),
              payload,
            )
          : await createTransformation(payload);
      } catch (err) {
        setFormError(
          err?.message || "Unable to save progress.",
        );
        return;
      }

      if (imageFile) {
        try {
          await uploadTransformationImage(
            getTransformationId(saved),
            imageFile,
            "image",
          );
        } catch (err) {
          setFormOpen(false);
          setEditingRecord(null);
          setImageFile(null);
          setError(
            `Progress saved, but the image upload failed: ${
              err?.message || "Unknown error."
            }`,
          );

          await loadProgress();
          return;
        }
      }

      setFormOpen(false);
      setEditingRecord(null);
      setImageFile(null);

      await loadProgress();
    } finally {
      setFormSubmitting(false);
    }
  }

  async function handleDelete(record) {
    const transformationId = getTransformationId(record);

    const confirmed = window.confirm(
      `Delete Week ${getWeek(record)} progress for ${member?.name || memberId}?`,
    );

    if (!confirmed) {
      return;
    }

    try {
      setDetailLoading(true);
      setError("");

      await deleteTransformation(transformationId);

      await loadProgress();
    } catch (err) {
      setError(err?.message || "Unable to delete progress.");
    } finally {
      setDetailLoading(false);
    }
  }

  if (loading) {
    return (
      <section
        className={`staff-progress-page${
          embedded ? " is-embedded" : ""
        }`}
      >
        <div className="staff-progress-detail-loading">
          <span />
          <span />
          <span />
        </div>
      </section>
    );
  }

  return (
    <>
      <section
        className={`staff-progress-page${
          embedded ? " is-embedded" : ""
        }`}
      >
        {showHeader && (
          <header className="staff-progress-detail-header">
            <div className="staff-progress-detail-title">
              <div>
                <p>MEMBER / PROGRESS</p>

                <h1>{member?.name || memberId}</h1>

                <span>{memberId}</span>
              </div>

              <div className="staff-progress-member-avatar">
                {getInitials(member?.name || memberId)}
              </div>
            </div>
          </header>
        )}

        {error && <div className="staff-progress-inline-error">{error}</div>}

        {detailLoading ? (
          <div className="staff-progress-detail-loading">
            <span />
            <span />
            <span />
          </div>
        ) : (
          <>
            <section className="staff-progress-detail-stats">
              <article>
                <span>PROGRESS RECORDS</span>

                <strong>{selectedRecords.length}</strong>
              </article>

              <article>
                <span>CURRENT WEEK</span>

                <strong>
                  {latestRecord
                    ? String(getWeek(latestRecord)).padStart(2, "0")
                    : "—"}
                </strong>
              </article>

              <article>
                <span>CURRENT WEIGHT</span>

                <strong>
                  {formatWeight(latestWeight)}

                  {latestWeight !== null && latestWeight !== undefined && (
                    <small> KG</small>
                  )}
                </strong>
              </article>

              <article>
                <span>CHANGE</span>

                <strong
                  className={
                    weightChange !== null && weightChange < 0
                      ? "staff-progress-change-down"
                      : ""
                  }
                >
                  {weightChange === null
                    ? "—"
                    : `${weightChange > 0 ? "+" : ""}${weightChange.toFixed(2)}`}

                  {weightChange !== null && <small> KG</small>}
                </strong>
              </article>
            </section>

            <section className="staff-progress-action-bar">
              <div>
                <p>TRANSFORMATION TRACKING</p>

                <span>Record the member's weekly progress.</span>
              </div>

              <button
                type="button"
                className="staff-progress-primary-button"
                onClick={openCreateForm}
              >
                + ADD PROGRESS
              </button>
            </section>

            {latestRecord && (
              <section className="staff-progress-latest">
                <div className="staff-progress-section-heading">
                  <div>
                    <p>LATEST UPDATE</p>

                    <h2>WEEK {String(getWeek(latestRecord)).padStart(2, "0")}</h2>
                  </div>

                  <span>{formatDate(getRecordedDate(latestRecord))}</span>
                </div>

                <div className="staff-progress-latest-grid">
                  <div className="staff-progress-photo-card">
                    {getImageUrl(latestRecord) ? (
                      <img
                        src={getImageUrl(latestRecord)}
                        alt={`${member?.name || memberId} progress`}
                      />
                    ) : (
                      <div className="staff-progress-photo-empty">
                        <span>NO PROGRESS IMAGE</span>
                      </div>
                    )}

                    <div className="staff-progress-photo-overlay">
                      <div>
                        <span>TRANSFORMATION PHOTO</span>

                        <strong>WEEK {getWeek(latestRecord)}</strong>
                      </div>

                      <button
                        type="button"
                        className="staff-progress-photo-edit"
                        onClick={() => openEditForm(latestRecord)}
                      >
                        EDIT UPDATE
                      </button>
                    </div>
                  </div>

                  <div className="staff-progress-latest-info">
                    <div>
                      <span>WEIGHT</span>

                      <strong>
                        {formatWeight(getWeight(latestRecord))}

                        {getWeight(latestRecord) !== null && <small> KG</small>}
                      </strong>
                    </div>

                    <div>
                      <span>RECORDED</span>

                      <strong>{formatDate(getRecordedDate(latestRecord))}</strong>
                    </div>

                    <div className="staff-progress-notes">
                      <span>NOTES</span>

                      <p>
                        {getNotes(latestRecord) || "No notes recorded for this update."}
                      </p>
                    </div>
                  </div>
                </div>
              </section>
            )}

            <section className="staff-progress-history">
              <div className="staff-progress-section-heading">
                <div>
                  <p>PROGRESS HISTORY</p>

                  <h2>EVERY UPDATE.</h2>
                </div>

                <span>
                  {selectedRecords.length} RECORD{selectedRecords.length === 1 ? "" : "S"}
                </span>
              </div>

              {selectedRecords.length === 0 ? (
                <div className="staff-progress-empty">
                  <p>NO PROGRESS RECORDS</p>

                  <span>Start tracking this member's weekly transformation.</span>

                  <button
                    type="button"
                    className="staff-progress-empty-button"
                    onClick={openCreateForm}
                  >
                    + ADD FIRST UPDATE
                  </button>
                </div>
              ) : (
                <div className="staff-progress-history-list">
                  {selectedRecords.map((record, index) => {
                    const imageUrl = getImageUrl(record);

                    return (
                      <article
                        className={`staff-progress-history-card ${
                          index === 0 ? "is-latest" : ""
                        }`}
                        key={getTransformationId(record)}
                      >
                        <div className="staff-progress-history-week">
                          <span>WEEK</span>

                          <strong>
                            {String(getWeek(record)).padStart(2, "0")}
                          </strong>
                        </div>

                        <div className="staff-progress-history-photo">
                          {imageUrl ? (
                            <img
                              src={imageUrl}
                              alt={`Week ${getWeek(record)} transformation`}
                            />
                          ) : (
                            <div>NO IMAGE</div>
                          )}
                        </div>

                        <div className="staff-progress-history-main">
                          <span>{formatDate(getRecordedDate(record))}</span>

                          <h3>WEEK {String(getWeek(record)).padStart(2, "0")} UPDATE</h3>

                          <p>{getNotes(record) || "No notes recorded."}</p>
                        </div>

                        <div className="staff-progress-history-weight">
                          <span>WEIGHT</span>

                          <strong>
                            {formatWeight(getWeight(record))}

                            {getWeight(record) !== null && <small> KG</small>}
                          </strong>
                        </div>

                        <div className="staff-progress-history-actions">
                          <button type="button" onClick={() => openEditForm(record)}>
                            EDIT
                          </button>

                          <button
                            type="button"
                            className="is-delete"
                            onClick={() => handleDelete(record)}
                          >
                            DELETE
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </section>
          </>
        )}
      </section>

      {formOpen && (
        <div
          className="staff-progress-modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeForm();
            }
          }}
        >
          <section
            className="staff-progress-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="progress-form-title"
          >
            <div className="staff-progress-modal-header">
              <div>
                <p>{editingRecord ? "EDIT PROGRESS" : "NEW PROGRESS"}</p>

                <h2 id="progress-form-title">
                  {editingRecord
                    ? `WEEK ${String(getWeek(editingRecord)).padStart(2, "0")}`
                    : "ADD UPDATE."}
                </h2>

                <span>
                  {member?.name} · {memberId}
                </span>
              </div>

              <button
                type="button"
                className="staff-progress-modal-close"
                onClick={closeForm}
                disabled={formSubmitting}
                aria-label="Close"
              >
                ×
              </button>
            </div>

            <form className="staff-progress-form" onSubmit={handleFormSubmit}>
              {formError && <div className="staff-progress-form-error">{formError}</div>}

              <div className="staff-progress-form-grid">
                <label>
                  <span>WEEK NUMBER</span>

                  <input
                    type="number"
                    name="week_number"
                    min="1"
                    step="1"
                    value={formData.week_number}
                    onChange={handleFormChange}
                    required
                  />
                </label>

                <label>
                  <span>RECORDED DATE</span>

                  <input
                    type="date"
                    name="recorded_date"
                    value={formData.recorded_date}
                    onChange={handleFormChange}
                    required
                  />
                </label>
              </div>

              <label>
                <span>WEIGHT — KG</span>

                <input
                  type="number"
                  name="weight_kg"
                  min="0.1"
                  max="500"
                  step="0.01"
                  value={formData.weight_kg}
                  onChange={handleFormChange}
                  placeholder="72.50"
                  required
                />
              </label>

              <label
                className={`staff-progress-form-drop${
                  imageDragActive ? " is-dragging" : ""
                }`}
                onDragOver={(event) => {
                  event.preventDefault();
                  setImageDragActive(true);
                }}
                onDragLeave={() => setImageDragActive(false)}
                onDrop={handleImageDrop}
              >
                <span>PROGRESS IMAGE</span>

                <input
                  type="file"
                  accept=".jpg,.jpeg,.png,.webp"
                  onChange={(event) => {
                    handleImageFile(
                      event.target.files?.[0],
                    );
                    event.target.value = "";
                  }}
                  disabled={formSubmitting}
                />

                <strong>
                  {imageFile
                    ? imageFile.name
                    : "DROP A PROGRESS IMAGE"}
                </strong>

                <small>
                  JPEG, PNG or WebP · max 10 MB
                </small>
              </label>

              {formData.image_url && (
                <div className="staff-progress-form-preview">
                  <img
                    src={formData.image_url}
                    alt="Progress preview"
                    onError={(event) => {
                      event.currentTarget.style.display = "none";
                    }}
                  />

                  <span>CURRENT IMAGE</span>
                </div>
              )}

              <label>
                <span>NOTES</span>

                <textarea
                  name="notes"
                  value={formData.notes}
                  onChange={handleFormChange}
                  placeholder="Record a short progress note..."
                  rows="5"
                />
              </label>

              <div className="staff-progress-form-actions">
                {editingRecord && (
                  <button
                    type="button"
                    className="staff-progress-form-delete"
                    onClick={() => {
                      closeForm();
                      handleDelete(editingRecord);
                    }}
                    disabled={formSubmitting}
                  >
                    DELETE RECORD
                  </button>
                )}

                <div>
                  <button
                    type="button"
                    className="staff-progress-form-cancel"
                    onClick={closeForm}
                    disabled={formSubmitting}
                  >
                    CANCEL
                  </button>

                  <button
                    type="submit"
                    className="staff-progress-primary-button"
                    disabled={formSubmitting}
                  >
                    {formSubmitting
                      ? "SAVING..."
                      : editingRecord
                        ? "SAVE CHANGES"
                        : "SAVE PROGRESS"}
                  </button>
                </div>
              </div>
            </form>
          </section>
        </div>
      )}
    </>
  );
}

export default MemberProgressSection;
