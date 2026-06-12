"use client";

import { useEffect, useState } from "react";
import { useOrders, type Order, type DashboardTask } from "@/components/OrderContext";

// ─────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────

const THEME_KEY = "order_tracker_theme";
type Theme = "light" | "dark";

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  root.classList.remove("light", "dark");
  root.classList.add(theme);
}

function readStoredTheme(): Theme {
  if (typeof window === "undefined") return "light";
  const stored = localStorage.getItem(THEME_KEY);
  if (stored === "dark" || stored === "light") return stored;
  // Fall back to system preference
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

/** Convert orders array to CSV string. */
function exportToCSV(orders: Order[], dashboardTasks: DashboardTask[]): string {
  const headers = [
    "ID",
    "Order Name / Number",
    "Client Name",
    "Test Name",
    "Test Method",
    "Custom Test Name",
    "Description",
    "Start Date",
    "End Date",
    "Client Updation Interval (hrs)",
    "Status",
    "Created At",
    "Updated At",
  ];

  const escape = (val: string | number) => {
    const s = String(val);
    // Wrap in quotes if the value contains a comma, quote, or newline
    if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };

  const rows = orders.map((o) => [
    o.id,
    o.order_name_number,
    o.client_name,
    o.test_name,
    o.test_method,
    o.custom_test_name || "",
    o.description,
    o.start_date,
    o.end_date,
    o.client_updation_interval.toString(),
    o.status,
    o.created_at,
    o.updated_at,
  ].map(escape).join(","));

  const taskHeaders = [
    "Task ID",
    "Order ID",
    "Order Name / Number",
    "Task Type",
    "Task Date",
    "Task Status",
  ];

  const taskRows = dashboardTasks.map((t) => {
    const order = orders.find((o) => o.id === t.order_id);
    const orderName = order ? order.order_name_number : "Unknown Order";
    return [
      t.id,
      t.order_id,
      orderName,
      t.task_type,
      t.task_date,
      t.task_status,
    ].map(escape).join(",");
  });

  return [
    "--- ORDERS ---",
    headers.join(","),
    ...rows,
    "",
    "--- TASK STATUS LOGS ---",
    taskHeaders.join(","),
    ...taskRows
  ].join("\r\n");
}

function downloadCSV(content: string, filename: string) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// ─────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────

function SettingCard({
  icon,
  title,
  description,
  children,
  danger,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  children: React.ReactNode;
  danger?: boolean;
}) {
  return (
    <div
      className={`flex flex-col gap-4 rounded-2xl border bg-white p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between ${
        danger
          ? "border-red-100 ring-1 ring-red-100"
          : "border-slate-100 ring-1 ring-slate-900/[0.03]"
      }`}
    >
      <div className="flex items-start gap-4">
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
            danger
              ? "bg-red-50 text-red-500"
              : "bg-slate-100 text-slate-500"
          }`}
        >
          {icon}
        </div>
        <div className="min-w-0">
          <p className={`text-sm font-semibold ${danger ? "text-red-700" : "text-slate-800"}`}>
            {title}
          </p>
          <p className="mt-0.5 text-xs text-slate-400 leading-relaxed">{description}</p>
        </div>
      </div>
      <div className="flex-shrink-0 sm:ml-6">{children}</div>
    </div>
  );
}

// Toggle switch
function ThemeToggle({
  isDark,
  onToggle,
}: {
  isDark: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      id="settings-theme-toggle"
      role="switch"
      aria-checked={isDark}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      onClick={onToggle}
      className={`
        relative inline-flex h-7 w-14 cursor-pointer items-center rounded-full
        transition-colors duration-300 focus-visible:outline-none focus-visible:ring-2
        focus-visible:ring-offset-2
        ${isDark
          ? "bg-indigo-600 focus-visible:ring-indigo-500"
          : "bg-slate-200 focus-visible:ring-slate-400"
        }
      `}
    >
      <span className="sr-only">{isDark ? "Dark" : "Light"} mode</span>
      <span
        className={`
          flex h-5 w-5 items-center justify-center rounded-full bg-white shadow-sm
          transition-transform duration-300
          ${isDark ? "translate-x-8" : "translate-x-1"}
        `}
      >
        {isDark ? (
          // Moon icon
          <svg className="h-3 w-3 text-indigo-600" viewBox="0 0 24 24" fill="currentColor">
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
          </svg>
        ) : (
          // Sun icon
          <svg className="h-3 w-3 text-amber-500" viewBox="0 0 24 24" fill="currentColor">
            <circle cx="12" cy="12" r="5" />
            <line x1="12" y1="1" x2="12" y2="3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            <line x1="12" y1="21" x2="12" y2="23" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            <line x1="1" y1="12" x2="3" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            <line x1="21" y1="12" x2="23" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        )}
      </span>
    </button>
  );
}

// ─────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────

export default function SettingsSection() {
  const { orders, dashboardTasks } = useOrders();
  const [theme, setTheme] = useState<Theme>("light");
  const [exportDone, setExportDone] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);

  // Read stored theme on mount
  useEffect(() => {
    const stored = readStoredTheme();
    setTheme(stored);
    applyTheme(stored);
  }, []);

  // ── Theme toggle ─────────────────────────────────

  function handleThemeToggle() {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    applyTheme(next);
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch { /* ignore */ }
  }

  // ── Export CSV ───────────────────────────────────

  function handleExport() {
    const csv = exportToCSV(orders, dashboardTasks);
    const ts = new Date().toISOString().slice(0, 10);
    downloadCSV(csv, `order_tracker_export_${ts}.csv`);
    setExportDone(true);
    setTimeout(() => setExportDone(false), 3000);
  }

  // ── Share App ─────────────────────────────────────

  function handleShare() {
    try {
      const shareUrl = typeof window !== "undefined" ? window.location.href : "https://tracker.microlabs.com";
      navigator.clipboard.writeText(shareUrl);
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 3000);
    } catch { /* ignore */ }
  }

  // ── Double-confirmation reset ────────────────────

  function handleResetAll() {
    const confirmed1 = window.confirm("Are you sure you want to reset all data?");
    if (!confirmed1) return;

    const confirmed2 = window.confirm("This action cannot be undone. Are you absolutely sure?");
    if (!confirmed2) return;

    try {
      localStorage.clear();
    } catch { /* ignore */ }
    window.location.reload();
  }

  // ── Render ───────────────────────────────────────

  return (
    <section aria-label="Settings" className="space-y-8">

      {/* Section heading */}
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-700 text-white shadow-sm">
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        </div>
        <div>
          <h2 className="text-base font-bold text-slate-800">Settings</h2>
          <p className="text-xs text-slate-400">Manage app preferences and data</p>
        </div>
      </div>

      {/* ── Appearance ─────────────────────────────── */}
      <div className="space-y-3">
        <h3 className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 pl-1">
          Appearance
        </h3>
        <SettingCard
          icon={
            theme === "dark" ? (
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
              </svg>
            ) : (
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="5" />
                <line x1="12" y1="1" x2="12" y2="3" />
                <line x1="12" y1="21" x2="12" y2="23" />
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                <line x1="1" y1="12" x2="3" y2="12" />
                <line x1="21" y1="12" x2="23" y2="12" />
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
              </svg>
            )
          }
          title="App Theme"
          description={`Currently using ${theme === "dark" ? "dark" : "light"} mode. Toggle to switch the app appearance.`}
        >
          <div className="flex items-center gap-3">
            <span className="text-xs font-medium text-slate-500">
              {theme === "dark" ? "Dark" : "Light"}
            </span>
            <ThemeToggle isDark={theme === "dark"} onToggle={handleThemeToggle} />
          </div>
        </SettingCard>
      </div>

      {/* ── Data ────────────────────────────────────── */}
      <div className="space-y-3">
        <h3 className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 pl-1">
          Data
        </h3>

        {/* Export */}
        <SettingCard
          icon={
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
          }
          title="Export Data"
          description={`Download all ${orders.length} order${orders.length !== 1 ? "s" : ""} as a CSV file compatible with Excel and Google Sheets.`}
        >
          <button
            id="settings-export-csv"
            onClick={handleExport}
            disabled={orders.length === 0}
            className={`
              flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold
              transition-all duration-200 active:scale-95
              ${exportDone
                ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
                : orders.length === 0
                  ? "cursor-not-allowed bg-slate-100 text-slate-400"
                  : "bg-slate-800 text-white hover:bg-slate-700 shadow-sm"
              }
            `}
          >
            {exportDone ? (
              <>
                <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M2.5 8.5 6 12l7.5-8" />
                </svg>
                Exported!
              </>
            ) : (
              <>
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                Download .csv
              </>
            )}
          </button>
        </SettingCard>
      </div>

      {/* ── Share App ─────────────────────────────── */}
      <div className="space-y-3">
        <h3 className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 pl-1">
          Share
        </h3>
        <SettingCard
          icon={
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="18" cy="5" r="3" />
              <circle cx="6" cy="12" r="3" />
              <circle cx="18" cy="19" r="3" />
              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
              <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
            </svg>
          }
          title="Share Application"
          description="Copy a shareable link of the laboratory tracker app to send to other team members."
        >
          <button
            id="settings-share-app"
            onClick={handleShare}
            className={`
              flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold
              transition-all duration-200 active:scale-95
              ${shareCopied
                ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
                : "bg-slate-800 text-white hover:bg-slate-700 shadow-sm"
              }
            `}
          >
            {shareCopied ? (
              <>
                <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M2.5 8.5 6 12l7.5-8" />
                </svg>
                Link Copied!
              </>
            ) : (
              <>
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                </svg>
                Copy Link
              </>
            )}
          </button>
        </SettingCard>
      </div>

      {/* ── Danger zone ──────────────────────────────── */}
      <div className="space-y-3">
        <h3 className="text-[10px] font-semibold uppercase tracking-widest text-red-400 pl-1">
          Danger Zone
        </h3>

        <SettingCard
          danger
          icon={
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
              <path d="M10 11v6M14 11v6" />
              <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
            </svg>
          }
          title="Reset All Data"
          description="Permanently delete all orders and clear local storage. This action cannot be undone."
        >
          <button
            id="settings-reset-btn"
            onClick={handleResetAll}
            className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-100 active:scale-95"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
              <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
            </svg>
            Reset All Data
          </button>
        </SettingCard>
      </div>

      {/* App info footer */}
      <div className="rounded-2xl border border-slate-100 bg-slate-50 px-5 py-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-blue-600 text-white">
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 3h6M9 3v7l-4.5 9A1 1 0 0 0 5.4 21h13.2a1 1 0 0 0 .9-1.45L15 10V3" />
                <path d="M6.5 15h11" />
              </svg>
            </div>
            <p className="text-xs font-semibold text-slate-600">Order Tracker</p>
          </div>
          <div className="flex items-center gap-3 text-[10px] text-slate-400">
            <span>v1.0.0</span>
            <span>·</span>
            <span>{orders.length} order{orders.length !== 1 ? "s" : ""} stored</span>
            <span>·</span>
            <span>Data stored locally</span>
          </div>
        </div>
      </div>

    </section>
  );
}
