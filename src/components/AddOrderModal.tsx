"use client";

import React, { useEffect, useId, useRef, useState } from "react";
import { useOrders, type OrderInput, type OrderStatus, type ValidationError } from "./OrderContext";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

interface AddOrderModalProps {
  /** Whether the modal is visible. */
  isOpen: boolean;
  /** Called when the modal should close (cancel or success). */
  onClose: () => void;
}

interface FormState {
  order_name_number: string;
  client_name: string;
  test_name: string;
  custom_test_name: string;
  test_method: string;
  custom_test_method: string;
  description: string;
  start_date: string;
  end_date: string;
  client_updation_interval: string; // string while in input, parsed on submit
  status: OrderStatus;
}

const EMPTY_FORM: FormState = {
  order_name_number: "",
  client_name: "",
  test_name: "",
  custom_test_name: "",
  test_method: "",
  custom_test_method: "",
  description: "",
  start_date: "",
  end_date: "",
  client_updation_interval: "",
  status: "pending",
};

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

/** Returns true only when every field has a valid value. */
function isFormValid(f: FormState): boolean {
  if (!f.order_name_number.trim() || f.order_name_number.trim().length < 2) return false;
  if (!f.client_name.trim()) return false;
  if (!f.test_name.trim()) return false;
  if (f.test_name === "Custom" && !f.custom_test_name.trim()) return false;
  if (!f.test_method.trim()) return false;
  if (f.test_method === "Custom" && !f.custom_test_method.trim()) return false;
  if (!f.description.trim()) return false;
  if (!f.start_date) return false;
  if (!f.end_date) return false;
  if (f.start_date > f.end_date) return false;
  const interval = Number(f.client_updation_interval);
  if (!f.client_updation_interval || isNaN(interval) || interval <= 0 || !Number.isInteger(interval)) return false;
  return true;
}

// ─────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────

interface FieldProps {
  id: string;
  label: string;
  error?: string;
  required?: boolean;
  children: React.ReactNode;
}

function Field({ id, label, error, required, children }: FieldProps) {
  return (
    <div className="flex flex-col gap-1">
      <label
        htmlFor={id}
        className="text-xs font-semibold uppercase tracking-wider text-slate-500"
      >
        {label}
        {required && <span className="ml-0.5 text-blue-500">*</span>}
      </label>
      {children}
      {error && (
        <p className="flex items-center gap-1 text-xs text-red-500 mt-0.5">
          <svg className="h-3 w-3 shrink-0" viewBox="0 0 16 16" fill="currentColor">
            <path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1zm-.75 3.75a.75.75 0 0 1 1.5 0v3.5a.75.75 0 0 1-1.5 0v-3.5zm.75 7a.875.875 0 1 1 0-1.75.875.875 0 0 1 0 1.75z" />
          </svg>
          {error}
        </p>
      )}
    </div>
  );
}

const inputClass =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 placeholder:text-slate-300 outline-none ring-0 transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 disabled:opacity-50 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-100 dark:focus:border-blue-500 dark:focus:ring-blue-900/30";

// ─────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────

export default function AddOrderModal({ isOpen, onClose }: AddOrderModalProps) {
  const { addOrder } = useOrders();
  const uid = useId(); // stable prefix for input IDs
  const firstInputRef = useRef<HTMLInputElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [serverErrors, setServerErrors] = useState<ValidationError[]>([]);
  const [touched, setTouched] = useState<Partial<Record<keyof FormState, boolean>>>({});
  const [submitting, setSubmitting] = useState(false);
  const [successAnim, setSuccessAnim] = useState(false);

  // Focus first input when modal opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => firstInputRef.current?.focus(), 50);
    } else {
      // Reset state when closed
      setForm(EMPTY_FORM);
      setServerErrors([]);
      setTouched({});
      setSubmitting(false);
      setSuccessAnim(false);
    }
  }, [isOpen]);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen, onClose]);

  // ── Handlers ────────────────────────────────

  function set(field: keyof FormState, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setServerErrors((prev) => prev.filter((e) => e.field !== field));
  }

  function touch(field: keyof FormState) {
    setTouched((prev) => ({ ...prev, [field]: true }));
  }

  function serverError(field: keyof FormState): string | undefined {
    return serverErrors.find((e) => e.field === field)?.message;
  }

  // Inline validation only shown after a field is touched
  function inlineError(field: keyof FormState): string | undefined {
    if (!touched[field]) return undefined;
    switch (field) {
      case "order_name_number":
        if (!form.order_name_number.trim()) return "Order name/number is required.";
        if (form.order_name_number.trim().length < 2) return "Must be at least 2 characters.";
        break;
      case "client_name":
        if (!form.client_name.trim()) return "Client name is required.";
        break;
      case "test_name":
        if (!form.test_name.trim()) return "Test name selection is required.";
        break;
      case "custom_test_name":
        if (form.test_name === "Custom" && !form.custom_test_name.trim()) return "Custom test name is required.";
        break;
      case "test_method":
        if (!form.test_method.trim()) return "Test method selection is required.";
        break;
      case "custom_test_method":
        if (form.test_method === "Custom" && !form.custom_test_method.trim()) return "Custom test method is required.";
        break;
      case "description":
        if (!form.description.trim()) return "Description is required.";
        break;
      case "start_date":
        if (!form.start_date) return "Start date is required.";
        break;
      case "end_date":
        if (!form.end_date) return "End date is required.";
        if (form.start_date && form.end_date < form.start_date) return "End date must be on or after start date.";
        break;
      case "client_updation_interval": {
        const v = Number(form.client_updation_interval);
        if (!form.client_updation_interval) return "Client updation interval is required.";
        if (isNaN(v) || v <= 0) return "Must be a positive number.";
        if (!Number.isInteger(v)) return "Must be a whole number of hours.";
        break;
      }
    }
    return serverError(field);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isFormValid(form) || submitting) return;
    setSubmitting(true);

    const input: OrderInput = {
      order_name_number: form.order_name_number.trim(),
      client_name: form.client_name.trim(),
      test_name: form.test_name === "Custom" ? form.custom_test_name.trim() : form.test_name,
      custom_test_name: form.test_name === "Custom" ? form.custom_test_name.trim() : undefined,
      test_method: form.test_method === "Custom" ? form.custom_test_method.trim() : form.test_method,
      description: form.description.trim(),
      start_date: form.start_date,
      end_date: form.end_date,
      client_updation_interval: Number(form.client_updation_interval),
      status: form.status,
    };

    try {
      addOrder(input);
      setSuccessAnim(true);
      setTimeout(() => onClose(), 600);
    } catch (errs) {
      if (Array.isArray(errs)) {
        setServerErrors(errs as ValidationError[]);
        const touchMap: Partial<Record<keyof FormState, boolean>> = {};
        (errs as ValidationError[]).forEach((e) => { touchMap[e.field as keyof FormState] = true; });
        setTouched((prev) => ({ ...prev, ...touchMap }));
      }
      setSubmitting(false);
    }
  }

  if (!isOpen) return null;

  const valid = isFormValid(form);

  return (
    <div
      ref={overlayRef}
      id={`${uid}-overlay`}
      role="dialog"
      aria-modal="true"
      aria-labelledby={`${uid}-title`}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto"
      onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}
    >
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm dark:bg-slate-950/60" aria-hidden="true" />

      <div
        className={`
          relative z-10 w-full max-w-2xl rounded-2xl bg-white dark:bg-slate-900 shadow-2xl ring-1 ring-slate-900/5
          transition-all duration-300 my-8
          ${successAnim ? "scale-95 opacity-0" : "scale-100 opacity-100"}
        `}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800/60 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 dark:bg-blue-950/20 text-blue-600 dark:text-blue-400">
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 3h6M9 3v7l-4.5 9A1 1 0 0 0 5.4 21h13.2a1 1 0 0 0 .9-1.45L15 10V3" />
                <path d="M6.5 15h11" />
              </svg>
            </div>
            <div>
              <h2 id={`${uid}-title`} className="text-base font-bold text-slate-800 dark:text-slate-100">
                New Test Order
              </h2>
              <p className="text-xs text-slate-400 dark:text-slate-500">Fill in all fields to submit</p>
            </div>
          </div>
          <button
            id={`${uid}-close`}
            onClick={onClose}
            aria-label="Close modal"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300 transition-colors"
          >
            <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M3 3l10 10M13 3L3 13" />
            </svg>
          </button>
        </div>

        {/* Form body */}
        <form id={`${uid}-form`} onSubmit={handleSubmit} noValidate>
          <div className="grid grid-cols-1 gap-5 px-6 py-5 sm:grid-cols-2 max-h-[60vh] overflow-y-auto">

            {/* Order Name / Number */}
            <Field id={`${uid}-orderNameNumber`} label="Order Name / Number" required error={inlineError("order_name_number")}>
              <input
                ref={firstInputRef}
                id={`${uid}-orderNameNumber`}
                type="text"
                autoComplete="off"
                placeholder="Ex: TOCR Number"
                value={form.order_name_number}
                onChange={(e) => set("order_name_number", e.target.value)}
                onBlur={() => touch("order_name_number")}
                className={inputClass}
              />
            </Field>

            {/* Client Name */}
            <Field id={`${uid}-clientName`} label="Client Name" required error={inlineError("client_name")}>
              <input
                id={`${uid}-clientName`}
                type="text"
                autoComplete="off"
                placeholder="e.g. Acme Corp"
                value={form.client_name}
                onChange={(e) => set("client_name", e.target.value)}
                onBlur={() => touch("client_name")}
                className={inputClass}
              />
            </Field>

            {/* Test Name Select */}
            <Field id={`${uid}-testName`} label="Test Name" required error={inlineError("test_name")}>
              <select
                id={`${uid}-testName`}
                value={form.test_name}
                onChange={(e) => set("test_name", e.target.value)}
                onBlur={() => touch("test_name")}
                className={inputClass}
              >
                <option value="">-- Select Test --</option>
                <option value="Quality Analysis">Quality Analysis</option>
                <option value="Tensile Testing">Tensile Testing</option>
                <option value="Flexural Testing">Flexural Testing</option>
                <option value="Impact Testing">Impact Testing</option>
                <option value="Thermal Reliability">Thermal Reliability</option>
                <option value="Custom">Custom</option>
              </select>
            </Field>

            {/* Test Method Select */}
            <Field id={`${uid}-testMethod`} label="Test Method" required error={inlineError("test_method")}>
              <select
                id={`${uid}-testMethod`}
                value={form.test_method}
                onChange={(e) => set("test_method", e.target.value)}
                onBlur={() => touch("test_method")}
                className={inputClass}
              >
                <option value="">-- Select Method --</option>
                <option value="ASTM D638">ASTM D638</option>
                <option value="ASTM D790">ASTM D790</option>
                <option value="ISO 527">ISO 527</option>
                <option value="ISO 178">ISO 178</option>
                <option value="Custom">Custom</option>
              </select>
            </Field>

            {/* Custom Test Name (Conditional) */}
            {form.test_name === "Custom" && (
              <div className="sm:col-span-2">
                <Field id={`${uid}-customTestName`} label="Custom Test Name" required error={inlineError("custom_test_name")}>
                  <input
                    id={`${uid}-customTestName`}
                    type="text"
                    placeholder="Enter custom test name"
                    value={form.custom_test_name}
                    onChange={(e) => set("custom_test_name", e.target.value)}
                    onBlur={() => touch("custom_test_name")}
                    className={inputClass}
                  />
                </Field>
              </div>
            )}

            {/* Custom Test Method (Conditional) */}
            {form.test_method === "Custom" && (
              <div className="sm:col-span-2">
                <Field id={`${uid}-customTestMethod`} label="Custom Test Method" required error={inlineError("custom_test_method")}>
                  <input
                    id={`${uid}-customTestMethod`}
                    type="text"
                    placeholder="Enter custom test method"
                    value={form.custom_test_method}
                    onChange={(e) => set("custom_test_method", e.target.value)}
                    onBlur={() => touch("custom_test_method")}
                    className={inputClass}
                  />
                </Field>
              </div>
            )}

            {/* Description — full width */}
            <div className="sm:col-span-2">
              <Field id={`${uid}-description`} label="Description" required error={inlineError("description")}>
                <textarea
                  id={`${uid}-description`}
                  rows={2}
                  placeholder="Brief description of the test order…"
                  value={form.description}
                  onChange={(e) => set("description", e.target.value)}
                  onBlur={() => touch("description")}
                  className={`${inputClass} resize-none`}
                />
              </Field>
            </div>

            {/* Start Date */}
            <Field id={`${uid}-startDate`} label="Start Date" required error={inlineError("start_date")}>
              <input
                id={`${uid}-startDate`}
                type="date"
                value={form.start_date}
                max={form.end_date || undefined}
                onChange={(e) => set("start_date", e.target.value)}
                onBlur={() => touch("start_date")}
                className={inputClass}
              />
            </Field>

            {/* End Date */}
            <Field id={`${uid}-endDate`} label="End Date" required error={inlineError("end_date")}>
              <input
                id={`${uid}-endDate`}
                type="date"
                value={form.end_date}
                min={form.start_date || undefined}
                onChange={(e) => set("end_date", e.target.value)}
                onBlur={() => touch("end_date")}
                className={inputClass}
              />
            </Field>

            {/* Client Updation Interval */}
            <Field id={`${uid}-clientUpdationInterval`} label="Client Updation Interval (hours)" required error={inlineError("client_updation_interval")}>
              <div className="relative">
                <input
                  id={`${uid}-clientUpdationInterval`}
                  type="number"
                  min="1"
                  step="1"
                  placeholder="e.g. 100"
                  value={form.client_updation_interval}
                  onChange={(e) => set("client_updation_interval", e.target.value)}
                  onBlur={() => touch("client_updation_interval")}
                  className={`${inputClass} pr-14`}
                />
                <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs font-semibold text-slate-400">
                  hrs
                </span>
              </div>
            </Field>

            {/* Initial Status */}
            <Field id={`${uid}-status`} label="Initial Status" required>
              <select
                id={`${uid}-status`}
                value={form.status}
                onChange={(e) => set("status", e.target.value as OrderStatus)}
                className={inputClass}
              >
                <option value="pending">Pending</option>
                <option value="in-progress">In Progress</option>
                <option value="completed">Completed</option>
                <option value="overdue">Overdue</option>
              </select>
            </Field>

          </div>

          {/* Footer */}
          <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-800/60 px-6 py-4">
            {/* Progress indicator */}
            <div className="flex items-center gap-1.5">
              {(["order_name_number", "client_name", "test_name", "test_method", "description", "start_date", "end_date", "client_updation_interval"] as (keyof FormState)[]).map((f) => {
                const hasErr = inlineError(f) || (f === "test_name" && form.test_name === "Custom" && inlineError("custom_test_name")) || (f === "test_method" && form.test_method === "Custom" && inlineError("custom_test_method"));
                const isTouched = touched[f];
                return (
                  <div
                    key={f}
                    className={`h-1.5 w-5 rounded-full transition-colors duration-200 ${
                      !isTouched
                        ? "bg-slate-200 dark:bg-slate-800"
                        : hasErr
                        ? "bg-red-400"
                        : "bg-blue-400 dark:bg-blue-500"
                    }`}
                  />
                );
              })}
            </div>

            <div className="flex gap-3">
              <button
                id={`${uid}-cancel`}
                type="button"
                onClick={onClose}
                className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-2 text-sm font-semibold text-slate-600 dark:text-slate-400 transition hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-800 dark:hover:text-slate-200"
              >
                Cancel
              </button>
              <button
                id={`${uid}-submit`}
                type="submit"
                disabled={!valid || submitting}
                className={`
                  relative flex items-center gap-2 rounded-lg px-5 py-2 text-sm font-bold text-white
                  transition-all duration-200
                  ${valid && !submitting
                    ? "bg-blue-600 hover:bg-blue-700 active:scale-95 shadow-md shadow-blue-500/10"
                    : "cursor-not-allowed bg-slate-300 dark:bg-slate-800 text-slate-400 dark:text-slate-600"}
                `}
              >
                {submitting ? (
                  <>
                    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <circle className="opacity-25" cx="12" cy="12" r="10" />
                      <path className="opacity-75" d="M12 2a10 10 0 0 1 10 10" />
                    </svg>
                    Saving…
                  </>
                ) : (
                  <>
                    <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <path d="M13.5 4.5 6.5 11.5 2.5 7.5" />
                    </svg>
                    Submit Order
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
