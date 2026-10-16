
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import {
  createMember,
  deactivateMember,
  getMembers,
  updateMember,
} from "../../api/client";

import "./MembersPage.css";

const SESSION_OPTIONS = [
  { value: "", label: "Not selected" },
  { value: "morning_first", label: "Morning · 05:30–07:30" },
  { value: "morning_second", label: "Morning · 07:30–09:30" },
  { value: "evening_first", label: "Evening · 17:30–19:30" },
  { value: "evening_second", label: "Evening · 19:30–21:30" },
];

const EMPTY_FORM = {
  member_id: "",
  password: "",
  name: "",
  phone: "",
  email: "",
  date_of_birth: "",
  gender: "",
  joining_date: "",
  status: "active",
  emergency_contact: "",
  preferred_session: "",
};

function getInitials(name) {
  if (!name) return "DF";

  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function formatDate(value) {
  if (!value) return "Not recorded";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function formatSession(value) {
  const session = SESSION_OPTIONS.find(
    (option) => option.value === value,
  );

  return session?.label || "Session not selected";
}

function normalizeMemberForForm(member) {
  return {
    member_id: member?.member_id || "",
    password: "",
    name: member?.name || "",
    phone: member?.phone || "",
    email: member?.email || "",
    date_of_birth: member?.date_of_birth || "",
    gender: member?.gender || "",
    joining_date: member?.joining_date || "",
    status: member?.status || "active",
    emergency_contact: member?.emergency_contact || "",
    preferred_session: member?.preferred_session || "",
  };
}

function MembersPage() {
  const navigate = useNavigate();

  const [members, setMembers] = useState([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [editingMember, setEditingMember] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);

  const [saving, setSaving] = useState(false);
  const [actionMemberId, setActionMemberId] = useState("");
  const [formError, setFormError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  async function loadMembers() {
    try {
      setLoading(true);
      setError("");

      const data = await getMembers();

      setMembers(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(
        err.message || "We couldn't load the member list right now.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadMembers();
  }, []);

  const filteredMembers = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return members
      .filter((member) => {
        if (statusFilter === "all") return true;

        return (
          String(member?.status || "").toLowerCase() === statusFilter
        );
      })
      .filter((member) => {
        if (!normalizedSearch) return true;

        const searchableText = [
          member?.member_id,
          member?.name,
          member?.phone,
          member?.email,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return searchableText.includes(normalizedSearch);
      })
      .sort((first, second) =>
        String(first?.name || "").localeCompare(
          String(second?.name || ""),
        ),
      );
  }, [members, search, statusFilter]);

  const activeCount = useMemo(
    () =>
      members.filter(
        (member) =>
          String(member?.status || "").toLowerCase() === "active",
      ).length,
    [members],
  );

  const inactiveCount = members.length - activeCount;

  function openCreateModal() {
    setEditingMember(null);
    setForm({ ...EMPTY_FORM, status: "active" });
    setFormError("");
    setSuccessMessage("");
    setModalOpen(true);
  }

  function openEditModal(member) {
    setEditingMember(member);
    setForm(normalizeMemberForForm(member));
    setFormError("");
    setSuccessMessage("");
    setModalOpen(true);
  }

  function closeModal() {
    if (saving) return;

    setModalOpen(false);
    setEditingMember(null);
    setForm(EMPTY_FORM);
    setFormError("");
  }

  function handleFormChange(event) {
    const { name, value } = event.target;

    setForm((current) => ({
      ...current,
      [name]: value,
    }));
  }

  
  function validateForm() {
    if (!form.member_id.trim()) {
      return "Member ID is required.";
    }

    if (!form.name.trim()) {
      return "Member name is required.";
    }

    if (!form.phone.trim()) {
      return "Phone number is required.";
    }

    if (!form.joining_date) {
      return "Joining date is required.";
    }

    if (!editingMember) {
      const password = form.password;

      if (!password) {
        return "Please create a password for this member.";
      }

      if (password.length < 8) {
        return "Your password must contain at least 8 characters.";
      }

      if (/^\d+$/.test(password)) {
        return "Your password cannot contain only numbers. Mix letters and numbers.";
      }

      const commonPasswords = [
        "password",
        "password123",
        "12345678",
        "123456789",
        "qwerty123",
        "abc12345",
        "admin123",
      ];

      if (commonPasswords.includes(password.toLowerCase())) {
        return "This password is too common. Please choose a stronger password.";
      }

      if (!/[a-zA-Z]/.test(password) || !/\d/.test(password)) {
        return "Use a combination of letters and numbers in your password.";
      }
    }

    if (form.email.trim()) {
      const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

      if (!emailPattern.test(form.email.trim())) {
        return "Enter a valid email address.";
      }
    }

    return "";
  }


  async function handleSubmit(event) {
    event.preventDefault();

    const validationError = validateForm();

    if (validationError) {
      setFormError(validationError);
      return;
    }

    try {
      setSaving(true);
      setFormError("");
      setSuccessMessage("");

      const payload = {
        member_id: form.member_id.trim(),
        name: form.name.trim(),
        phone: form.phone.trim(),
        email: form.email.trim() || null,
        date_of_birth: form.date_of_birth || null,
        gender: form.gender || null,
        joining_date: form.joining_date,
        status: form.status || "active",
        emergency_contact: form.emergency_contact.trim() || null,
        preferred_session: form.preferred_session || null,
      };

      let savedMember;

      if (editingMember?.member_id) {
        savedMember = await updateMember(
          editingMember.member_id,
          payload,
        );
      } else {
        payload.password = form.password;
        savedMember = await createMember(payload);
      }

      const returnedMember = savedMember?.value || savedMember;

      if (returnedMember?.member_id) {
        setMembers((current) => {
          const existingIndex = current.findIndex(
            (member) =>
              member.member_id === returnedMember.member_id,
          );

          if (existingIndex === -1) {
            return [...current, returnedMember];
          }

          return current.map((member, index) =>
            index === existingIndex ? returnedMember : member,
          );
        });
      } else {
        await loadMembers();
      }

      const wasEditing = Boolean(editingMember);

      setModalOpen(false);
      setEditingMember(null);
      setForm(EMPTY_FORM);

      setSuccessMessage(
        wasEditing
          ? "Member updated successfully."
          : "Member added successfully.",
      );
    } catch (err) {
      setFormError(
        err.message || "We couldn't save this member. Please try again.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleStatusToggle(member) {
    if (!member?.member_id) return;

    const isActive =
      String(member.status || "").toLowerCase() === "active";

    if (isActive) {
      const confirmed = window.confirm(
        `Deactivate ${member.name || "this member"}?`,
      );

      if (!confirmed) return;
    }

    try {
      setActionMemberId(member.member_id);
      setError("");
      setSuccessMessage("");

      if (isActive) {
        await deactivateMember(member.member_id);

        setMembers((current) =>
          current.map((currentMember) =>
            currentMember.member_id === member.member_id
              ? { ...currentMember, status: "inactive" }
              : currentMember,
          ),
        );

        setSuccessMessage(
          `${member.name || "Member"} has been deactivated.`,
        );
      } else {
        const updatedMember = await updateMember(
          member.member_id,
          {
            ...normalizeMemberForForm(member),
            status: "active",
            email: member.email || null,
            date_of_birth: member.date_of_birth || null,
            gender: member.gender || null,
            emergency_contact: member.emergency_contact || null,
            preferred_session: member.preferred_session || null,
          },
        );

        const returnedMember = updatedMember?.value || updatedMember;

        setMembers((current) =>
          current.map((currentMember) =>
            currentMember.member_id === member.member_id
              ? returnedMember
              : currentMember,
          ),
        );

        setSuccessMessage(
          `${member.name || "Member"} has been activated.`,
        );
      }
    } catch (err) {
      setError(
        err.message || "We couldn't update this member's status.",
      );
    } finally {
      setActionMemberId("");
    }
  }

  function handleSelectMember(member) {
    if (!member?.member_id) return;

    navigate(`/staff/members/${member.member_id}`);
  }

  if (loading) {
    return (
      <section className="members-page">
        <div className="members-skeleton-header">
          <div className="members-skeleton-block members-skeleton-title" />
          <div className="members-skeleton-block members-skeleton-action" />
        </div>

        <div className="members-skeleton-toolbar">
          <div className="members-skeleton-block members-skeleton-search" />
          <div className="members-skeleton-block members-skeleton-filter" />
        </div>

        <div className="members-skeleton-grid">
          {Array.from({ length: 6 }).map((_, index) => (
            <div className="member-skeleton-card" key={index}>
              <div className="member-skeleton-avatar" />
              <div className="member-skeleton-lines">
                <span />
                <span />
                <span />
              </div>
            </div>
          ))}
        </div>
      </section>
    );
  }

  return (
    <section className="members-page">
      <header className="members-page-header">
        <div className="members-page-heading">
          <p className="members-eyebrow">STAFF / MEMBERS</p>

          <h1>
            KNOW
            <br />
            YOUR
            <br />
            MEMBERS.
          </h1>

          <p className="members-page-intro">
            One place to find, manage and move into every member&apos;s
            complete fitness journey.
          </p>
        </div>

        <div className="members-page-header-side">
          <div className="members-total-block">
            <span>TOTAL MEMBERS</span>
            <strong>{members.length}</strong>
          </div>

          <button
            type="button"
            className="members-primary-button"
            onClick={openCreateModal}
          >
            <span>+</span>
            ADD MEMBER
          </button>
        </div>
      </header>

      <div className="members-overview-strip">
        <div className="members-overview-item">
          <span>ACTIVE</span>
          <strong>{activeCount}</strong>
        </div>

        <div className="members-overview-divider" />

        <div className="members-overview-item">
          <span>INACTIVE</span>
          <strong>{inactiveCount}</strong>
        </div>

        <div className="members-overview-divider" />

        <div className="members-overview-copy">
          <span>WORKFLOW</span>
          <p>
            Select a member to continue into their attendance, workout,
            diet, progress and membership records.
          </p>
        </div>
      </div>

      {successMessage && (
        <div className="members-feedback members-feedback-success">
          <span>?</span>
          <p>{successMessage}</p>
          <button
            type="button"
            onClick={() => setSuccessMessage("")}
            aria-label="Dismiss success message"
          >
            ×
          </button>
        </div>
      )}

      {error && (
        <div className="members-feedback members-feedback-error">
          <span>!</span>
          <p>{error}</p>
          <button type="button" onClick={loadMembers}>
            TRY AGAIN
          </button>
        </div>
      )}

      <section className="members-directory">
        <div className="members-directory-header">
          <div>
            <p className="members-eyebrow">DIRECTORY</p>
            <h2>ALL MEMBERS</h2>
          </div>

          <p className="members-result-count">
            {filteredMembers.length}{" "}
            {filteredMembers.length === 1 ? "MEMBER" : "MEMBERS"} SHOWN
          </p>
        </div>

        <div className="members-toolbar">
          <label className="members-search">
            <span className="members-search-icon">/</span>

            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="SEARCH BY NAME, ID, PHONE OR EMAIL"
              aria-label="Search members"
            />

            {search && (
              <button
                type="button"
                className="members-search-clear"
                onClick={() => setSearch("")}
                aria-label="Clear search"
              >
                ×
              </button>
            )}
          </label>

          <div className="members-status-filter">
            {[
              ["all", "ALL"],
              ["active", "ACTIVE"],
              ["inactive", "INACTIVE"],
            ].map(([value, label]) => (
              <button
                type="button"
                key={value}
                className={statusFilter === value ? "is-active" : ""}
                onClick={() => setStatusFilter(value)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {filteredMembers.length === 0 ? (
          <div className="members-empty">
            <div className="members-empty-mark">+</div>

            <p className="members-eyebrow">NO RESULTS</p>

            <h3>
              {search || statusFilter !== "all"
                ? "NOTHING MATCHED."
                : "NO MEMBERS YET."}
            </h3>

            <p>
              {search || statusFilter !== "all"
                ? "Try another search or change the status filter."
                : "Add the first member to start building their fitness record."}
            </p>

            {(search || statusFilter !== "all") && (
              <button
                type="button"
                className="members-outline-button"
                onClick={() => {
                  setSearch("");
                  setStatusFilter("all");
                }}
              >
                RESET FILTERS
              </button>
            )}
          </div>
        ) : (
          <div className="members-grid">
            {filteredMembers.map((member) => {
              const isActive =
                String(member?.status || "").toLowerCase() === "active";

              const isUpdating = actionMemberId === member.member_id;

              return (
                <article className="member-card" key={member.member_id}>
                  <button
                    type="button"
                    className="member-card-main"
                    onClick={() => handleSelectMember(member)}
                    aria-label={`Open ${member.name || "member"} profile`}
                  >
                    <div className="member-card-top">
                      <div className="member-avatar">
                        {getInitials(member.name)}
                      </div>

                      <span
                        className={`member-status ${
                          isActive
                            ? "member-status-active"
                            : "member-status-inactive"
                        }`}
                      >
                        {isActive ? "ACTIVE" : "INACTIVE"}
                      </span>
                    </div>

                    <div className="member-card-identity">
                      <span className="member-id">
                        {member.member_id || "NO MEMBER ID"}
                      </span>

                      <h3>{member.name || "Unnamed Member"}</h3>
                    </div>

                    <div className="member-card-details">
                      <div>
                        <span>PHONE</span>
                        <strong>{member.phone || "Not recorded"}</strong>
                      </div>

                      <div>
                        <span>JOINED</span>
                        <strong>{formatDate(member.joining_date)}</strong>
                      </div>

                      <div>
                        <span>SESSION</span>
                        <strong>
                          {formatSession(member.preferred_session)}
                        </strong>
                      </div>
                    </div>

                    <div className="member-card-arrow">?</div>
                  </button>

                  <div className="member-card-actions">
                    <button
                      type="button"
                      onClick={() => openEditModal(member)}
                    >
                      EDIT
                    </button>

                    <button
                      type="button"
                      disabled={isUpdating}
                      onClick={() => handleStatusToggle(member)}
                    >
                      {isUpdating
                        ? "UPDATING..."
                        : isActive
                          ? "DEACTIVATE"
                          : "ACTIVATE"}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {modalOpen && (
        <div
          className="members-modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeModal();
            }
          }}
        >
          <div
            className="members-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="member-modal-title"
          >
            <div className="members-modal-header">
              <div>
                <p className="members-eyebrow">
                  {editingMember ? "MEMBER RECORD" : "NEW MEMBER"}
                </p>

                <h2 id="member-modal-title">
                  {editingMember ? "EDIT MEMBER." : "ADD MEMBER."}
                </h2>
              </div>

              <button
                type="button"
                className="members-modal-close"
                onClick={closeModal}
                aria-label="Close member form"
              >
                ×
              </button>
            </div>

            {formError && (
              <div className="members-form-error">
                <span>!</span>
                <p>{formError}</p>
              </div>
            )}

            <form className="members-form" onSubmit={handleSubmit}>
              <div className="members-form-section">
                <div className="members-form-section-heading">
                  <span>01</span>
                  <div>
                    <p className="members-eyebrow">IDENTITY</p>
                    <h3>CORE DETAILS</h3>
                  </div>
                </div>

                <div className="members-form-grid">
                  <label className="members-field">
                    <span>MEMBER ID *</span>
                    <input
                      name="member_id"
                      value={form.member_id}
                      onChange={handleFormChange}
                      placeholder="MEM-0003"
                      disabled={Boolean(editingMember)}
                    />
                  </label>

                  <label className="members-field">
                    <span>FULL NAME *</span>
                    <input
                      name="name"
                      value={form.name}
                      onChange={handleFormChange}
                      placeholder="Arun Kumar"
                    />
                  </label>

                  <label className="members-field">
                    <span>PHONE *</span>
                    <input
                      name="phone"
                      value={form.phone}
                      onChange={handleFormChange}
                      placeholder="+91 98765 43210"
                      inputMode="tel"
                    />
                  </label>


                  {!editingMember && (
                    <label className="members-field">
                      <span>PASSWORD *</span>
                      <input
                        name="password"
                        type="password"
                        value={form.password}
                        onChange={(event) => {
                          handleFormChange(event);
                          setFormError("");
                        }}
                        placeholder="Minimum 8 characters"
                        minLength={8}
                        autoComplete="new-password"
                        required
                        aria-describedby="member-password-help"
                      />
                      <small id="member-password-help">
                        Use at least 8 characters, including letters and numbers.
                      </small>
                    </label>
                  )}


                  <label className="members-field">
                    <span>EMAIL</span>
                    <input
                      name="email"
                      type="email"
                      value={form.email}
                      onChange={handleFormChange}
                      placeholder="member@example.com"
                    />
                  </label>
                </div>
              </div>

              <div className="members-form-section">
                <div className="members-form-section-heading">
                  <span>02</span>
                  <div>
                    <p className="members-eyebrow">PROFILE</p>
                    <h3>PERSONAL DETAILS</h3>
                  </div>
                </div>

                <div className="members-form-grid">
                  <label className="members-field">
                    <span>DATE OF BIRTH</span>
                    <input
                      name="date_of_birth"
                      type="date"
                      value={form.date_of_birth}
                      onChange={handleFormChange}
                    />
                  </label>

                  <label className="members-field">
                    <span>GENDER</span>
                    <select
                      name="gender"
                      value={form.gender}
                      onChange={handleFormChange}
                    >
                      <option value="">Not selected</option>
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                      <option value="other">Other</option>
                    </select>
                  </label>

                  <label className="members-field">
                    <span>JOINING DATE *</span>
                    <input
                      name="joining_date"
                      type="date"
                      value={form.joining_date}
                      onChange={handleFormChange}
                    />
                  </label>

                  <label className="members-field">
                    <span>STATUS</span>
                    <select
                      name="status"
                      value={form.status}
                      onChange={handleFormChange}
                    >
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                    </select>
                  </label>
                </div>
              </div>

              <div className="members-form-section">
                <div className="members-form-section-heading">
                  <span>03</span>
                  <div>
                    <p className="members-eyebrow">GYM</p>
                    <h3>SESSION & CONTACT</h3>
                  </div>
                </div>

                <div className="members-form-grid">
                  <label className="members-field members-field-wide">
                    <span>PREFERRED SESSION</span>
                    <select
                      name="preferred_session"
                      value={form.preferred_session}
                      onChange={handleFormChange}
                    >
                      {SESSION_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="members-field members-field-wide">
                    <span>EMERGENCY CONTACT</span>
                    <input
                      name="emergency_contact"
                      value={form.emergency_contact}
                      onChange={handleFormChange}
                      placeholder="Name · Phone · Relationship"
                    />
                  </label>
                </div>
              </div>

              <div className="members-form-footer">
                <button
                  type="button"
                  className="members-outline-button"
                  onClick={closeModal}
                  disabled={saving}
                >
                  CANCEL
                </button>

                <button
                  type="submit"
                  className="members-primary-button"
                  disabled={saving}
                >
                  {saving
                    ? "SAVING..."
                    : editingMember
                      ? "SAVE CHANGES"
                      : "CREATE MEMBER"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}

export default MembersPage;
