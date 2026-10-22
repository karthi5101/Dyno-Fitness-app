import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import {
  createPayment,
  deletePayment,
  getMembers,
  getPayments,
} from "../../api/client";

import "./PaymentsPage.css";

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

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
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

const EMPTY_FORM = {
  member_id: "",
  amount: "",
  payment_date: getToday(),
  payment_method: "Cash",
  period_start: getToday(),
  period_end: getToday(),
  notes: "",
};

function PaymentsPage() {
  const navigate = useNavigate();

  const [members, setMembers] = useState([]);
  const [payments, setPayments] = useState([]);
  const [search, setSearch] = useState("");

  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState("");

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function loadData() {
    try {
      setLoading(true);
      setError("");

      const [memberData, paymentData] =
        await Promise.all([
          getMembers(),
          getPayments(),
        ]);

      setMembers(
        Array.isArray(memberData)
          ? memberData
          : [],
      );

      setPayments(
        Array.isArray(paymentData)
          ? paymentData
          : [],
      );
    } catch (err) {
      setError(
        err?.message ||
          "Unable to load payments.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (!error && !success) {
      return undefined;
    }

    const timer = window.setTimeout(() => {
      setError("");
      setSuccess("");
    }, 5000);

    return () => {
      window.clearTimeout(timer);
    };
  }, [error, success]);

  const memberMap = useMemo(() => {
    return new Map(
      members.map((member) => [
        member.member_id,
        member,
      ]),
    );
  }, [members]);

  const totalCollected = useMemo(() => {
    return payments.reduce(
      (total, payment) =>
        total +
        (Number(payment?.amount) || 0),
      0,
    );
  }, [payments]);

  const filteredPayments = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) {
      return payments;
    }

    return payments.filter((payment) => {
      const member = memberMap.get(
        payment?.member_id,
      );

      return [
        payment?.member_id,
        payment?.payment_method,
        payment?.notes,
        member?.name,
      ]
        .filter(Boolean)
        .some((value) =>
          String(value)
            .toLowerCase()
            .includes(query),
        );
    });
  }, [
    payments,
    memberMap,
    search,
  ]);

  function handleFormChange(event) {
    const { name, value } = event.target;

    setForm((current) => ({
      ...current,
      [name]: value,
    }));

    setFormError("");
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (!form.member_id) {
      setFormError(
        "Select the member this payment belongs to.",
      );
      return;
    }

    if (!form.amount || Number(form.amount) <= 0) {
      setFormError(
        "Enter a valid payment amount.",
      );
      return;
    }

    if (
      form.period_end &&
      form.period_start &&
      form.period_end < form.period_start
    ) {
      setFormError(
        "Period end date cannot be before the period start date.",
      );
      return;
    }

    try {
      setSaving(true);
      setFormError("");
      setError("");
      setSuccess("");

      const created = await createPayment({
        member_id: form.member_id,
        amount: form.amount,
        payment_date: form.payment_date,
        payment_method: form.payment_method,
        period_start: form.period_start,
        period_end: form.period_end,
        notes: form.notes,
      });

      setPayments((current) => [
        created,
        ...current,
      ]);

      setForm({
        ...EMPTY_FORM,
        member_id: form.member_id,
        payment_date: form.payment_date,
      });

      const member = memberMap.get(form.member_id);

      setSuccess(
        `Payment recorded for ${
          member?.name || form.member_id
        }.`,
      );
    } catch (err) {
      setFormError(
        err?.message ||
          "Unable to record this payment.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(paymentId) {
    if (!paymentId) {
      return;
    }

    const confirmed = window.confirm(
      "Delete this payment record?",
    );

    if (!confirmed) {
      return;
    }

    try {
      setDeletingId(String(paymentId));
      setError("");
      setSuccess("");

      await deletePayment(paymentId);

      setPayments((current) =>
        current.filter(
          (payment) =>
            String(payment?.id || payment?._id) !==
            String(paymentId),
        ),
      );

      setSuccess("Payment record deleted.");
    } catch (err) {
      setError(
        err?.message ||
          "Unable to delete this payment.",
      );
    } finally {
      setDeletingId("");
    }
  }

  if (loading) {
    return (
      <section className="staff-page payments-page">
        <div className="staff-state">
          <span className="staff-loader" />
          <p>Loading payments...</p>
        </div>
      </section>
    );
  }

  return (
    <section className="staff-page payments-page">
      <header className="staff-page-header">
        <div>
          <p className="staff-eyebrow">
            STAFF — PAYMENTS
          </p>

          <h1>
            THE BOOKS.
          </h1>

          <p>
            Record what members pay and keep every
            receipt tied to the right member.
          </p>
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

      <article className="payment-hero">
        <span>
          TOTAL COLLECTED
        </span>

        <strong>
          {formatAmount(totalCollected)}
        </strong>

        <small>
          {payments.length} PAYMENT
          {payments.length === 1 ? "" : "S"} RECORDED
        </small>
      </article>

      <div className="payment-grid">
        <form
          className="payment-form"
          onSubmit={handleSubmit}
        >
          <h2>Record payment.</h2>

          {formError && (
            <div className="staff-message staff-message-error">
              {formError}
            </div>
          )}

          <label>
            MEMBER
            <select
              name="member_id"
              value={form.member_id}
              onChange={handleFormChange}
              disabled={saving}
              required
            >
              <option value="">
                Select member
              </option>

              {members.map((member) => (
                <option
                  key={member.member_id}
                  value={member.member_id}
                >
                  {member.name} —{" "}
                  {member.member_id}
                </option>
              ))}
            </select>
          </label>

          <label>
            AMOUNT
            <input
              type="number"
              name="amount"
              min="0"
              step="0.01"
              value={form.amount}
              onChange={handleFormChange}
              disabled={saving}
              placeholder="2500"
              required
            />
          </label>

          <label>
            PAYMENT DATE
            <input
              type="date"
              name="payment_date"
              value={form.payment_date}
              onChange={handleFormChange}
              disabled={saving}
              required
            />
          </label>

          <label>
            PAYMENT METHOD
            <input
              name="payment_method"
              value={form.payment_method}
              onChange={handleFormChange}
              disabled={saving}
              placeholder="Cash / UPI / Card"
              required
            />
          </label>

          <label>
            PERIOD START
            <input
              type="date"
              name="period_start"
              value={form.period_start}
              onChange={handleFormChange}
              disabled={saving}
              required
            />
          </label>

          <label>
            PERIOD END
            <input
              type="date"
              name="period_end"
              value={form.period_end}
              onChange={handleFormChange}
              disabled={saving}
              required
            />
          </label>

          <label>
            NOTES
            <textarea
              name="notes"
              value={form.notes}
              onChange={handleFormChange}
              disabled={saving}
              placeholder="Optional note about this payment..."
              rows={3}
            />
          </label>

          <button
            type="submit"
            className="staff-button staff-button-dark"
            disabled={saving}
          >
            {saving
              ? "SAVING..."
              : "RECORD PAYMENT"}
          </button>
        </form>

        <section className="payment-list">
          <div className="payment-list-header">
            <h2>Payments.</h2>

            <input
              type="search"
              placeholder="Search member, method or note..."
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
            />
          </div>

          {filteredPayments.length === 0 ? (
            <div className="staff-empty">
              <strong>
                {search.trim()
                  ? "No matching payments."
                  : "No payments recorded yet."}
              </strong>

              <p>
                {search.trim()
                  ? "Try a different member name, ID or method."
                  : "Record the first payment using the form."}
              </p>
            </div>
          ) : (
            filteredPayments.map((payment) => {
              const member = memberMap.get(
                payment?.member_id,
              );

              const paymentId =
                payment?.id || payment?._id;

              const isDeleting =
                String(deletingId) ===
                String(paymentId);

              return (
                <article
                  className="payment-row"
                  key={String(
                    paymentId ||
                      `${payment?.member_id}-${payment?.payment_date}`,
                  )}
                >
                  <button
                    type="button"
                    className="payment-member"
                    onClick={() =>
                      navigate(
                        `/staff/members/${payment?.member_id}`,
                      )
                    }
                    disabled={
                      !payment?.member_id
                    }
                  >
                    <strong>
                      {member?.name ||
                        payment?.member_id ||
                        "Member"}
                    </strong>

                    <span>
                      {payment?.member_id} ·{" "}
                      {formatDate(
                        payment?.payment_date,
                      )}
                    </span>
                  </button>

                  <div>
                    <span>
                      {payment?.payment_method ||
                        "Payment"}
                    </span>

                    <small>
                      {formatDate(
                        payment?.period_start,
                      )}{" "}
                      —{" "}
                      {formatDate(
                        payment?.period_end,
                      )}
                    </small>
                  </div>

                  <div className="payment-amount">
                    {formatAmount(payment?.amount)}
                  </div>

                  <button
                    type="button"
                    className="staff-button staff-button-danger"
                    onClick={() =>
                      handleDelete(paymentId)
                    }
                    disabled={isDeleting}
                  >
                    {isDeleting
                      ? "DELETING..."
                      : "DELETE"}
                  </button>
                </article>
              );
            })
          )}
        </section>
      </div>
    </section>
  );
}

export default PaymentsPage;
