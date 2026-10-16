import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { useAuth } from "../../auth/AuthContext";
import { apiRequest, getMember } from "../../api/client";

import "./ProgressPage.css";

const FALLBACK_MEMBER_ID =
  localStorage.getItem("dyno_member_id") || "MEM-0001";

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

function getRecordedDate(record) {
  return record?.recorded_date || record?.date || "";
}

function getNotes(record) {
  return record?.notes || "";
}

function getFrontImageUrl(record) {
  return (
    record?.front_image_url ||
    record?.front_image ||
    record?.front_photo_url ||
    record?.front_photo ||
    ""
  );
}

function getBackImageUrl(record) {
  return (
    record?.back_image_url ||
    record?.back_image ||
    record?.back_photo_url ||
    record?.back_photo ||
    ""
  );
}

function getDefaultImageUrl(record) {
  return record?.image_url || record?.image || "";
}

function getPhotoOptions(record) {
  if (!record) {
    return [];
  }

  const options = [];

  const frontImage = getFrontImageUrl(record);
  const backImage = getBackImageUrl(record);
  const defaultImage = getDefaultImageUrl(record);

  if (frontImage) {
    options.push({
      key: "front",
      label: "FRONT VIEW",
      url: frontImage,
    });
  }

  if (backImage) {
    options.push({
      key: "back",
      label: "BACK VIEW",
      url: backImage,
    });
  }

  if (!options.length && defaultImage) {
    options.push({
      key: "progress",
      label: "TRANSFORMATION PHOTO",
      url: defaultImage,
    });
  }

  return options;
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
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return "—";
  }

  const numericValue = Number(value);

  if (Number.isNaN(numericValue)) {
    return String(value);
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
      .map((part) =>
        part.charAt(0).toUpperCase(),
      )
      .join("") || "M"
  );
}

function normalizeRecords(data) {
  if (Array.isArray(data)) {
    return data;
  }

  if (Array.isArray(data?.value)) {
    return data.value;
  }

  if (Array.isArray(data?.results)) {
    return data.results;
  }

  if (Array.isArray(data?.transformations)) {
    return data.transformations;
  }

  return [];
}

function ProgressPage() {
  const navigate = useNavigate();

  const { memberId: authenticatedMemberId } =
    useAuth();

  const memberId =
    authenticatedMemberId ||
    FALLBACK_MEMBER_ID;

  const [member, setMember] = useState(null);
  const [transformations, setTransformations] =
    useState([]);

  const [selectedPhoto, setSelectedPhoto] =
    useState("front");

  const [loading, setLoading] =
    useState(true);

  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;

    async function loadProgress() {
      try {
        setLoading(true);
        setError("");

        const [memberData, transformationData] =
          await Promise.all([
            getMember(memberId),
            apiRequest(
              `/transformations/${encodeURIComponent(
                memberId,
              )}/`,
            ),
          ]);

        if (!mounted) {
          return;
        }

        setMember(
          memberData?.value ||
            memberData ||
            null,
        );

        setTransformations(
          normalizeRecords(
            transformationData,
          ),
        );
      } catch (err) {
        if (!mounted) {
          return;
        }

        setError(
          err?.message ||
            "Unable to load your progress.",
        );
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    if (memberId) {
      loadProgress();
    } else {
      setLoading(false);
      setError(
        "Your member account is not linked to a Dyno member.",
      );
    }

    return () => {
      mounted = false;
    };
  }, [memberId]);

  const selectedRecords = useMemo(() => {
    return [...transformations].sort(
      (a, b) => {
        const weekDifference =
          Number(getWeek(b) || 0) -
          Number(getWeek(a) || 0);

        if (weekDifference !== 0) {
          return weekDifference;
        }

        return (
          new Date(
            getRecordedDate(b) || 0,
          ).getTime() -
          new Date(
            getRecordedDate(a) || 0,
          ).getTime()
        );
      },
    );
  }, [transformations]);

  const latestRecord =
    selectedRecords[0] || null;

  const earliestRecord =
    selectedRecords.length > 0
      ? selectedRecords[
          selectedRecords.length - 1
        ]
      : null;

  const latestWeight =
    getWeight(latestRecord);

  const startingWeight =
    getWeight(earliestRecord);

  const weightChange =
    latestWeight !== null &&
    latestWeight !== undefined &&
    startingWeight !== null &&
    startingWeight !== undefined
      ? Number(latestWeight) -
        Number(startingWeight)
      : null;

  const latestPhotoOptions =
    getPhotoOptions(latestRecord);

  const activePhoto =
    latestPhotoOptions.find(
      (photo) =>
        photo.key === selectedPhoto,
    ) ||
    latestPhotoOptions[0] ||
    null;

  useEffect(() => {
    if (
      latestPhotoOptions.length > 0 &&
      !latestPhotoOptions.some(
        (photo) =>
          photo.key === selectedPhoto,
      )
    ) {
      setSelectedPhoto(
        latestPhotoOptions[0].key,
      );
    }
  }, [
    latestPhotoOptions,
    selectedPhoto,
  ]);

  function handleBack() {
    navigate("/member/dashboard");
  }

  if (loading) {
    return (
      <section className="staff-progress-page">
        <div className="staff-progress-loading">
          <span />
          <span />
          <span />
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="staff-progress-page">
        <header className="staff-progress-detail-header">
          <button
            type="button"
            className="staff-progress-back"
            onClick={handleBack}
          >
            ← BACK TO DASHBOARD
          </button>

          <div className="staff-progress-detail-title">
            <div>
              <p>MEMBER / PROGRESS</p>

              <h1>
                PROGRESS
                <br />
                UNAVAILABLE.
              </h1>

              <span>{error}</span>
            </div>

            <div className="staff-progress-member-avatar">
              {getInitials(
                member?.name ||
                  memberId,
              )}
            </div>
          </div>
        </header>
      </section>
    );
  }

  return (
    <section className="staff-progress-page">
      <header className="staff-progress-detail-header">
        <button
          type="button"
          className="staff-progress-back"
          onClick={handleBack}
        >
          ← BACK TO DASHBOARD
        </button>

        <div className="staff-progress-detail-title">
          <div>
            <p>MEMBER / PROGRESS</p>

            <h1>
              {member?.name || memberId}
            </h1>

            <span>{memberId}</span>
          </div>

          <div className="staff-progress-member-avatar">
            {getInitials(
              member?.name || memberId,
            )}
          </div>
        </div>
      </header>

      <section className="staff-progress-detail-stats">
        <article>
          <span>PROGRESS RECORDS</span>

          <strong>
            {selectedRecords.length}
          </strong>
        </article>

        <article>
          <span>CURRENT WEEK</span>

          <strong>
            {latestRecord
              ? String(
                  getWeek(latestRecord),
                ).padStart(2, "0")
              : "—"}
          </strong>
        </article>

        <article>
          <span>CURRENT WEIGHT</span>

          <strong>
            {formatWeight(latestWeight)}

            {latestWeight !== null &&
              latestWeight !== undefined && (
                <small> KG</small>
              )}
          </strong>
        </article>

        <article>
          <span>CHANGE</span>

          <strong
            className={
              weightChange !== null &&
              weightChange < 0
                ? "staff-progress-change-down"
                : ""
            }
          >
            {weightChange === null
              ? "—"
              : `${
                  weightChange > 0
                    ? "+"
                    : ""
                }${weightChange.toFixed(
                  2,
                )}`}

            {weightChange !== null && (
              <small> KG</small>
            )}
          </strong>
        </article>
      </section>

      {latestRecord && (
        <section className="staff-progress-latest">
          <div className="staff-progress-section-heading">
            <div>
              <p>LATEST UPDATE</p>

              <h2>
                WEEK{" "}
                {String(
                  getWeek(latestRecord),
                ).padStart(2, "0")}
              </h2>
            </div>

            <span>
              {formatDate(
                getRecordedDate(
                  latestRecord,
                ),
              )}
            </span>
          </div>

          <div className="staff-progress-latest-grid">
            <div className="staff-progress-photo-card">
              {activePhoto?.url ? (
                <img
                  src={activePhoto.url}
                  alt={`${member?.name || memberId} ${activePhoto.label.toLowerCase()}`}
                />
              ) : (
                <div className="staff-progress-photo-empty">
                  <span>
                    NO PROGRESS IMAGE
                  </span>
                </div>
              )}

              <div className="staff-progress-photo-overlay">
                <div>
                  <span>
                    TRANSFORMATION PHOTO
                  </span>

                  <strong>
                    WEEK{" "}
                    {getWeek(
                      latestRecord,
                    )}
                  </strong>
                </div>

                {latestPhotoOptions.length >
                  1 && (
                  <div className="member-progress-photo-switcher">
                    {latestPhotoOptions.map(
                      (photo) => (
                        <button
                          key={photo.key}
                          type="button"
                          className={
                            photo.key ===
                            selectedPhoto
                              ? "is-active"
                              : ""
                          }
                          onClick={() =>
                            setSelectedPhoto(
                              photo.key,
                            )
                          }
                        >
                          {photo.key ===
                          "front"
                            ? "FRONT"
                            : photo.key ===
                                "back"
                              ? "BACK"
                              : "PHOTO"}
                        </button>
                      ),
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="staff-progress-latest-info">
              <div>
                <span>WEIGHT</span>

                <strong>
                  {formatWeight(
                    getWeight(
                      latestRecord,
                    ),
                  )}

                  {getWeight(
                    latestRecord,
                  ) !== null &&
                    getWeight(
                      latestRecord,
                    ) !== undefined && (
                      <small> KG</small>
                    )}
                </strong>
              </div>

              <div>
                <span>RECORDED</span>

                <strong>
                  {formatDate(
                    getRecordedDate(
                      latestRecord,
                    ),
                  )}
                </strong>
              </div>

              <div className="staff-progress-notes">
                <span>NOTES</span>

                <p>
                  {getNotes(
                    latestRecord,
                  ) ||
                    "No notes recorded for this update."}
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
            {selectedRecords.length} RECORD
            {selectedRecords.length === 1
              ? ""
              : "S"}
          </span>
        </div>

        {selectedRecords.length === 0 ? (
          <div className="staff-progress-empty">
            <p>NO PROGRESS RECORDS</p>

            <span>
              Your transformation history
              will appear here when your
              progress is recorded.
            </span>
          </div>
        ) : (
          <div className="staff-progress-history-list">
            {selectedRecords.map(
              (record, index) => {
                const photoOptions =
                  getPhotoOptions(record);

                const historyImage =
                  photoOptions[0]?.url || "";

                return (
                  <article
                    className={`staff-progress-history-card ${
                      index === 0
                        ? "is-latest"
                        : ""
                    }`}
                    key={getTransformationId(
                      record,
                    )}
                  >
                    <div className="staff-progress-history-week">
                      <span>WEEK</span>

                      <strong>
                        {String(
                          getWeek(record),
                        ).padStart(2, "0")}
                      </strong>
                    </div>

                    <div className="staff-progress-history-photo">
                      {historyImage ? (
                        <img
                          src={historyImage}
                          alt={`Week ${getWeek(record)} transformation`}
                        />
                      ) : (
                        <div>NO IMAGE</div>
                      )}
                    </div>

                    <div className="staff-progress-history-main">
                      <span>
                        {formatDate(
                          getRecordedDate(
                            record,
                          ),
                        )}
                      </span>

                      <h3>
                        WEEK{" "}
                        {String(
                          getWeek(record),
                        ).padStart(2, "0")}{" "}
                        UPDATE
                      </h3>

                      <p>
                        {getNotes(record) ||
                          "No notes recorded."}
                      </p>
                    </div>

                    <div className="staff-progress-history-weight">
                      <span>WEIGHT</span>

                      <strong>
                        {formatWeight(
                          getWeight(record),
                        )}

                        {getWeight(
                          record,
                        ) !== null &&
                          getWeight(
                            record,
                          ) !== undefined && (
                            <small> KG</small>
                          )}
                      </strong>
                    </div>
                  </article>
                );
              },
            )}
          </div>
        )}
      </section>
    </section>
  );
}

export default ProgressPage;