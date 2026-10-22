import { useEffect, useMemo, useState } from "react";

import {
  createNote,
  deleteNote,
  getMemberNotes,
  getMemberPayments,
  getMembership,
  updateNote,
} from "../../api/client";

import "./MemberProfileRecords.css";

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

function formatAmount(value) {
  if (value === null || value === undefined || value === "") {
    return "0";
  }

  const numeric = Number(value);

  if (Number.isNaN(numeric)) {
    return String(value);
  }

  return numeric.toLocaleString("en-IN", {
    maximumFractionDigits: 2,
  });
}

function daysUntil(value) {
  if (!value) {
    return null;
  }

  const today = new Date();
  const target = new Date(value);

  if (Number.isNaN(target.getTime())) {
    return null;
  }

  today.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);

  return Math.round(
    (target - today) / 86400000,
  );
}

/*
 * -------------------------------------------------------------------
 * MEMBERSHIP
 * -------------------------------------------------------------------
 */

function MembershipSection({ memberId }) {
  const [membership, setMembership] =
    useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadMembership() {
      try {
        setLoading(true);
        setError("");

        const response =
          await getMembership(memberId);

        if (!cancelled) {
          setMembership(response);
        }
      } catch (err) {
        if (!cancelled) {
          setMembership(null);
          setError(
            err?.message ||
              "Unable to load this member's membership.",
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    if (memberId) {
      loadMembership();
    }

    return () => {
      cancelled = true;
    };
  }, [memberId]);

  const remaining = useMemo(() => {
    return daysUntil(membership?.end_date);
  }, [membership?.end_date]);

  if (loading) {
    return (
      <section className="member-records-section">
        <div className="member-profile-attendance-loading">
          <span className="staff-loader" />

          <p>Loading membership...</p>
        </div>
      </section>
    );
  }

  return (
    <section className="member-records-section">
      <div className="member-profile-section-heading">
        <div>
          <p className="member-profile-eyebrow">
            MEMBER / MEMBERSHIP
          </p>

          <h2>
            THE PLAN.
          </h2>
        </div>

        <p>
          The current membership record for this
          member, exactly as stored in the database.
        </p>
      </div>

      {error && (
        <div className="member-profile-attendance-error">
          <span>!</span>

          <p>{error}</p>
        </div>
      )}

      {!membership ? (
        <div className="member-profile-attendance-empty">
          <strong>
            NO MEMBERSHIP.
          </strong>

          <p>
            This member does not have a membership
            record yet.
          </p>
        </div>
      ) : (
        <>
          <div className="member-records-grid">
            <article className="member-records-card member-records-card-dark">
              <span>PLAN</span>

              <strong>
                {membership.plan_name ||
                  "—"}
              </strong>

              <small>
                {String(
                  membership.status ||
                    "active",
                ).toUpperCase()}
              </small>
            </article>

            <article className="member-records-card">
              <span>START DATE</span>

              <strong>
                {formatDate(
                  membership.start_date,
                )}
              </strong>

              <small>Membership began</small>
            </article>

            <article className="member-records-card">
              <span>END DATE</span>

              <strong>
                {formatDate(
                  membership.end_date,
                )}
              </strong>

              <small>
                {remaining === null
                  ? "No end date"
                  : remaining < 0
                    ? `Expired ${Math.abs(
                        remaining,
                      )} days ago`
                    : `${remaining} days left`}
              </small>
            </article>
          </div>
        </>
      )}
    </section>
  );
}

/*
 * -------------------------------------------------------------------
 * PAYMENTS
 * -------------------------------------------------------------------
 */

function PaymentsSection({ memberId }) {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadPayments() {
      try {
        setLoading(true);
        setError("");

        const response =
          await getMemberPayments(memberId);

        if (!cancelled) {
          setPayments(
            Array.isArray(response)
              ? response
              : [],
          );
        }
      } catch (err) {
        if (!cancelled) {
          setPayments([]);
          setError(
            err?.message ||
              "Unable to load this member's payments.",
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    if (memberId) {
      loadPayments();
    }

    return () => {
      cancelled = true;
    };
  }, [memberId]);

  const total = useMemo(() => {
    return payments.reduce(
      (sum, payment) =>
        sum + (Number(payment?.amount) || 0),
      0,
    );
  }, [payments]);

  if (loading) {
    return (
      <section className="member-records-section">
        <div className="member-profile-attendance-loading">
          <span className="staff-loader" />

          <p>Loading payments...</p>
        </div>
      </section>
    );
  }

  return (
    <section className="member-records-section">
      <div className="member-profile-section-heading">
        <div>
          <p className="member-profile-eyebrow">
            MEMBER / PAYMENTS
          </p>

          <h2>
            THE RECEIPTS.
          </h2>
        </div>

        <p>
          Every payment recorded against this member,
          in the order it was saved.
        </p>
      </div>

      {error && (
        <div className="member-profile-attendance-error">
          <span>!</span>

          <p>{error}</p>
        </div>
      )}

      {payments.length === 0 ? (
        <div className="member-profile-attendance-empty">
          <strong>
            NO PAYMENTS.
          </strong>

          <p>
            No payment has been recorded for this
            member yet.
          </p>
        </div>
      ) : (
        <>
          <div className="member-records-total">
            <span>TOTAL COLLECTED</span>

            <strong>{formatAmount(total)}</strong>

            <small>
              {payments.length} RECORD
              {payments.length === 1 ? "" : "S"}
            </small>
          </div>

          <div className="member-profile-attendance-list">
            {payments.map((payment) => (
              <article
                className="member-profile-attendance-row"
                key={String(
                  payment?.id ||
                    payment?._id ||
                    `${payment?.member_id}-${payment?.payment_date}`,
                )}
              >
                <div>
                  <span>DATE</span>

                  <strong>
                    {formatDate(
                      payment?.payment_date,
                    )}
                  </strong>
                </div>

                <div>
                  <span>METHOD</span>

                  <strong>
                    {payment?.payment_method ||
                      "—"}
                  </strong>
                </div>

                <div>
                  <span>PERIOD</span>

                  <strong>
                    {formatDate(
                      payment?.period_start,
                    )}{" "}
                    —{" "}
                    {formatDate(
                      payment?.period_end,
                    )}
                  </strong>
                </div>

                <span className="member-profile-attendance-status is-present">
                  {formatAmount(payment?.amount)}
                </span>
              </article>
            ))}
          </div>
        </>
      )}
    </section>
  );
}

/*
 * -------------------------------------------------------------------
 * NOTES
 * -------------------------------------------------------------------
 */

function NotesSection({ memberId }) {
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");

  const [editingId, setEditingId] = useState("");
  const [editTitle, setEditTitle] = useState("");
  const [editBody, setEditBody] = useState("");

  async function loadNotes() {
    try {
      setLoading(true);
      setError("");

      const response =
        await getMemberNotes(memberId);

      setNotes(
        Array.isArray(response)
          ? response
          : [],
      );
    } catch (err) {
      setError(
        err?.message ||
          "Unable to load this member's notes.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!memberId) {
      return undefined;
    }

    loadNotes();

    return undefined;
  }, [memberId]);

  function resetForm() {
    setTitle("");
    setBody("");
  }

  async function handleCreate(event) {
    event.preventDefault();

    if (!body.trim()) {
      setError(
        "Write the note before saving it.",
      );
      return;
    }

    try {
      setSaving(true);
      setError("");
      setSuccess("");

      const created = await createNote({
        member_id: memberId,
        title: title.trim(),
        body: body.trim(),
      });

      setNotes((current) => [
        created,
        ...current,
      ]);

      resetForm();

      setSuccess("Note saved.");
    } catch (err) {
      setError(
        err?.message ||
          "Unable to save this note.",
      );
    } finally {
      setSaving(false);
    }
  }

  function startEditing(note) {
    setEditingId(String(note.id));
    setEditTitle(note.title || "");
    setEditBody(note.body || "");
    setError("");
    setSuccess("");
  }

  function cancelEditing() {
    setEditingId("");
    setEditTitle("");
    setEditBody("");
  }

  async function handleUpdate(noteId) {
    if (!editBody.trim()) {
      setError(
        "Write the note before saving it.",
      );
      return;
    }

    try {
      setSaving(true);
      setError("");
      setSuccess("");

      const updated = await updateNote(
        noteId,
        {
          title: editTitle.trim(),
          body: editBody.trim(),
        },
      );

      setNotes((current) =>
        current.map((note) =>
          String(note.id) === String(noteId)
            ? updated
            : note,
        ),
      );

      cancelEditing();

      setSuccess("Note updated.");
    } catch (err) {
      setError(
        err?.message ||
          "Unable to update this note.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(noteId) {
    const confirmed = window.confirm(
      "Delete this note?",
    );

    if (!confirmed) {
      return;
    }

    try {
      setSaving(true);
      setError("");
      setSuccess("");

      await deleteNote(noteId);

      setNotes((current) =>
        current.filter(
          (note) =>
            String(note.id) !== String(noteId),
        ),
      );

      setSuccess("Note deleted.");
    } catch (err) {
      setError(
        err?.message ||
          "Unable to delete this note.",
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <section className="member-records-section">
        <div className="member-profile-attendance-loading">
          <span className="staff-loader" />

          <p>Loading notes...</p>
        </div>
      </section>
    );
  }

  return (
    <section className="member-records-section">
      <div className="member-profile-section-heading">
        <div>
          <p className="member-profile-eyebrow">
            MEMBER / NOTES
          </p>

          <h2>
            THE CONTEXT.
          </h2>
        </div>

        <p>
          Staff-only notes about this member. They stay
          inside the staff application.
        </p>
      </div>

      {error && (
        <div className="member-profile-attendance-error">
          <span>!</span>

          <p>{error}</p>
        </div>
      )}

      {success && (
        <div className="member-workout-message member-workout-message-success">
          {success}
        </div>
      )}

      <form
        className="member-records-note-form"
        onSubmit={handleCreate}
      >
        <label>
          TITLE
          <input
            type="text"
            value={title}
            onChange={(event) =>
              setTitle(event.target.value)
            }
            placeholder="Optional short title"
            disabled={saving}
            maxLength={150}
          />
        </label>

        <label>
          NOTE
          <textarea
            value={body}
            onChange={(event) =>
              setBody(event.target.value)
            }
            placeholder="Write a note about this member..."
            rows={3}
            disabled={saving}
          />
        </label>

        <button
          type="submit"
          className="member-profile-primary-button"
          disabled={saving}
        >
          {saving ? "SAVING..." : "SAVE NOTE →"}
        </button>
      </form>

      {notes.length === 0 ? (
        <div className="member-profile-attendance-empty">
          <strong>
            NO NOTES YET.
          </strong>

          <p>
            Save the first note using the field above.
          </p>
        </div>
      ) : (
        <div className="member-records-note-list">
          {notes.map((note) => {
            const isEditing =
              editingId === String(note.id);

            return (
              <article
                className="member-records-note"
                key={String(note.id)}
              >
                {isEditing ? (
                  <>
                    <input
                      type="text"
                      value={editTitle}
                      onChange={(event) =>
                        setEditTitle(
                          event.target.value,
                        )
                      }
                      aria-label="Edit note title"
                      disabled={saving}
                      maxLength={150}
                      placeholder="Title"
                    />

                    <textarea
                      value={editBody}
                      onChange={(event) =>
                        setEditBody(
                          event.target.value,
                        )
                      }
                      aria-label="Edit note body"
                      rows={3}
                      disabled={saving}
                    />

                    <div className="member-records-note-actions">
                      <button
                        type="button"
                        onClick={() =>
                          handleUpdate(note.id)
                        }
                        disabled={saving}
                      >
                        {saving
                          ? "SAVING..."
                          : "SAVE"}
                      </button>

                      <button
                        type="button"
                        onClick={cancelEditing}
                        disabled={saving}
                      >
                        CANCEL
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="member-records-note-head">
                      <strong>
                        {note.title ||
                          "NOTE"}
                      </strong>

                      <small>
                        {formatDate(
                          note.created_at,
                        )}
                      </small>
                    </div>

                    <p>{note.body}</p>

                    <div className="member-records-note-actions">
                      <button
                        type="button"
                        onClick={() =>
                          startEditing(note)
                        }
                        disabled={saving}
                      >
                        EDIT
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          handleDelete(note.id)
                        }
                        disabled={saving}
                      >
                        DELETE
                      </button>
                    </div>
                  </>
                )}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

export {
  MembershipSection,
  NotesSection,
  PaymentsSection,
};
