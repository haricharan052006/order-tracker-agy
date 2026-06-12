"use client";

import { useState, useMemo } from "react";
import { format, parseISO } from "date-fns";
import AddOrderModal from "@/components/AddOrderModal";
import AllOrdersSection from "@/components/AllOrdersSection";
import MatrixSection from "@/components/MatrixSection";
import SettingsSection from "@/components/SettingsSection";
import { useOrders, type Order, type OrderStatus, type DashboardTask, isOrderArchived } from "@/components/OrderContext";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

type MainTab = "dashboard" | "orders" | "analytics" | "settings";
type DashboardSubTab = "yesterday" | "today" | "tomorrow";

const STATUS_META: Record<OrderStatus, { label: string; dot: string; badge: string }> = {
  pending: {
    label: "Pending",
    dot: "bg-amber-400",
    badge: "bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-950/20 dark:text-amber-300 dark:ring-amber-900/30",
  },
  "in-progress": {
    label: "In Progress",
    dot: "bg-blue-500",
    badge: "bg-blue-50 text-blue-700 ring-blue-200 dark:bg-blue-950/20 dark:text-blue-300 dark:ring-blue-900/30",
  },
  completed: {
    label: "Completed",
    dot: "bg-emerald-500",
    badge: "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-300 dark:ring-emerald-900/30",
  },
  overdue: {
    label: "Overdue",
    dot: "bg-red-500",
    badge: "bg-red-50 text-red-700 ring-red-200 dark:bg-red-950/20 dark:text-red-300 dark:ring-red-900/30",
  },
};

function StatusBadge({ status }: { status: OrderStatus }) {
  const meta = STATUS_META[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ${meta.badge}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
      {meta.label}
    </span>
  );
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function getTaskDates(order: Order): Date[] {
  const tasks: Date[] = [];
  try {
    const startParts = order.start_date.split("-").map(Number);
    const start = new Date(startParts[0], startParts[1] - 1, startParts[2], 0, 0, 0, 0);

    const endParts = order.end_date.split("-").map(Number);
    const end = new Date(endParts[0], endParts[1] - 1, endParts[2], 23, 59, 59, 999);

    const interval = order.client_updation_interval;
    if (interval <= 0) return [];

    const intervalMs = interval * 60 * 60 * 1000;
    let t = start.getTime() + intervalMs;

    while (t <= end.getTime()) {
      tasks.push(new Date(t));
      t += intervalMs;
    }
  } catch (e) {
    // ignore
  }
  return tasks;
}

function hasTaskOnDate(order: Order, dateStr: string): boolean {
  return getTaskDates(order).some(d => format(d, "yyyy-MM-dd") === dateStr);
}

function isCreatedOnDate(order: Order, dateStr: string): boolean {
  try {
    const createdDate = new Date(order.created_at);
    return format(createdDate, "yyyy-MM-dd") === dateStr;
  } catch {
    return false;
  }
}

function isEndingOnDate(order: Order, dateStr: string): boolean {
  return order.end_date === dateStr;
}

function getCardBgClass(order: Order, taskStatus?: "done" | "partial" | "not-updated") {
  if (order.status === "overdue") {
    return "bg-red-50/75 border-red-200 text-red-900 dark:bg-red-950/20 dark:border-red-900/30 shadow-sm shadow-red-500/[0.02]";
  }
  if (taskStatus === "done") {
    return "bg-emerald-50/75 border-emerald-200 text-emerald-900 dark:bg-emerald-950/20 dark:border-emerald-900/30 shadow-sm shadow-emerald-500/[0.02]";
  }
  if (taskStatus === "partial") {
    return "bg-amber-50/75 border-amber-200 text-amber-900 dark:bg-amber-950/20 dark:border-amber-900/30 shadow-sm shadow-amber-500/[0.02]";
  }
  if (taskStatus === "not-updated") {
    return "bg-slate-50/80 border-slate-200 text-slate-800 dark:bg-slate-900/50 dark:border-slate-800/60 shadow-sm";
  }
  return "bg-white border-slate-100 text-slate-800 dark:bg-slate-900 dark:border-slate-800 shadow-sm";
}

// ─────────────────────────────────────────────
// Dashboard Card Component
// ─────────────────────────────────────────────

function DashboardCard({
  order,
  type,
  dateStr,
  editable,
}: {
  order: Order;
  type: "creation" | "updation" | "ending";
  dateStr: string;
  editable: boolean;
}) {
  const { setTaskStatus, dashboardTasks } = useOrders();

  const taskRecord = useMemo(() => {
    return dashboardTasks.find(
      (t) => t.order_id === order.id && t.task_date === dateStr && t.task_type === type
    );
  }, [dashboardTasks, order.id, dateStr, type]);

  const taskStatus = taskRecord?.task_status || "not-updated";

  function handleStatusToggle(newStatus: "done" | "partial" | "not-updated") {
    if (!editable) return;
    setTaskStatus(order.id, dateStr, type, newStatus);
  }

  const bgClass = getCardBgClass(order, type === "updation" ? taskStatus : undefined);

  return (
    <article className={`group relative flex flex-col rounded-2xl border p-5 transition hover:shadow-md ${bgClass}`}>
      {/* Creation Banner */}
      {type === "creation" && (
        <div className="mb-4 flex items-center gap-1.5 rounded-xl bg-blue-100/50 px-3 py-1.5 ring-1 ring-blue-200 text-blue-700 dark:bg-blue-950/25 dark:ring-blue-900/30 dark:text-blue-300">
          <span className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse" />
          <p className="text-xs font-semibold">New order created</p>
        </div>
      )}

      {/* Ending Banner */}
      {type === "ending" && (
        <div className="mb-4 flex items-center gap-1.5 rounded-xl bg-amber-100/50 px-3 py-1.5 ring-1 ring-amber-200 text-amber-700 dark:bg-amber-950/25 dark:ring-amber-900/30 dark:text-amber-300 animate-pulse">
          <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <p className="text-xs font-bold">Testing ends today</p>
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">{order.order_name_number}</h3>
          <p className="mt-0.5 font-mono text-[10px] text-slate-400">{order.id.split("_")[1]}</p>
        </div>
        <StatusBadge status={order.status} />
      </div>

      {/* Meta Grid */}
      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2.5 text-xs">
        <div>
          <dt className="font-medium uppercase tracking-wide text-slate-400">Client</dt>
          <dd className="mt-0.5 truncate font-semibold text-slate-700 dark:text-slate-300">{order.client_name}</dd>
        </div>
        <div>
          <dt className="font-medium uppercase tracking-wide text-slate-400">Test Method</dt>
          <dd className="mt-0.5 truncate text-slate-700 dark:text-slate-300">
            {order.test_method === "Custom" ? order.custom_test_name || "Custom" : order.test_method}
          </dd>
        </div>
        <div>
          <dt className="font-medium uppercase tracking-wide text-slate-400">Start Date</dt>
          <dd className="mt-0.5 text-slate-600 dark:text-slate-400">{order.start_date}</dd>
        </div>
        <div>
          <dt className="font-medium uppercase tracking-wide text-slate-400">End Date</dt>
          <dd className="mt-0.5 text-slate-600 dark:text-slate-400">{order.end_date}</dd>
        </div>
        {order.description && (
          <div className="col-span-2">
            <dt className="font-medium uppercase tracking-wide text-slate-400">Description</dt>
            <dd className="mt-0.5 line-clamp-2 text-slate-600 dark:text-slate-400">{order.description}</dd>
          </div>
        )}
      </dl>

      {/* Task Status Toggle (Only for Updations) */}
      {type === "updation" && (
        <div className="mt-auto pt-4">
          <div className="border-t border-slate-100 dark:border-slate-800/60 pt-3">
            <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">
              Client Updation Status
            </p>
            {editable ? (
              <div className="flex gap-1">
                {(["done", "partial", "not-updated"] as const).map((status) => {
                  const active = taskStatus === status;
                  const colors = {
                    done: active ? "bg-emerald-600 text-white shadow-sm" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700",
                    partial: active ? "bg-amber-500 text-white shadow-sm" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700",
                    "not-updated": active ? "bg-slate-500 text-white shadow-sm" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700",
                  };
                  const labels = {
                    done: "Done",
                    partial: "Partial",
                    "not-updated": "Not Updated",
                  };
                  return (
                    <button
                      key={status}
                      onClick={() => handleStatusToggle(status)}
                      className={`flex-1 rounded-lg border py-1.5 text-center text-xs font-semibold select-none transition-all duration-200 ${colors[status]}`}
                    >
                      {labels[status]}
                    </button>
                  );
                })}
              </div>
            ) : (
              <span
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1 text-xs font-semibold ${taskStatus === "done"
                    ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-300 dark:ring-emerald-900/30"
                    : taskStatus === "partial"
                      ? "bg-amber-50 text-amber-700 ring-1 ring-amber-200 dark:bg-amber-950/20 dark:text-amber-300 dark:ring-amber-900/30"
                      : "bg-slate-100 text-slate-500 dark:bg-slate-800/80 dark:text-slate-400"
                  }`}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${taskStatus === "done"
                      ? "bg-emerald-500"
                      : taskStatus === "partial"
                        ? "bg-amber-400"
                        : "bg-slate-400"
                    }`}
                />
                {taskStatus === "done" ? "Done" : taskStatus === "partial" ? "Partial" : "Not Updated"}
              </span>
            )}
          </div>
        </div>
      )}
    </article>
  );
}

// ─────────────────────────────────────────────
// Empty State Component
// ─────────────────────────────────────────────

interface TabEmptyProps {
  tab: DashboardSubTab;
  onAdd: () => void;
}

function TabEmpty({ tab, onAdd }: TabEmptyProps) {
  const config = {
    yesterday: {
      title: "No activity yesterday",
      sub: "There were no tests created, updated, or ending yesterday.",
      showAdd: false,
    },
    today: {
      title: "No workflow tasks scheduled today",
      sub: "Create a new quality order to get started.",
      showAdd: true,
    },
    tomorrow: {
      title: "All clear for tomorrow",
      sub: "No pending endings or upcoming updations tomorrow.",
      showAdd: false,
    },
  }[tab];

  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-800 py-16 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500">
        <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
      <div>
        <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300">{config.title}</h4>
        <p className="mt-1 text-xs text-slate-400">{config.sub}</p>
      </div>
      {config.showAdd && (
        <button
          onClick={onAdd}
          className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-blue-700 active:scale-95"
        >
          New Order
        </button>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// Dashboard Tab Specific Analytics
// ─────────────────────────────────────────────

interface TabAnalyticsProps {
  pending: number;
  completed: number;
  overdue: number;
}

function TabAnalytics({ pending, completed, overdue }: TabAnalyticsProps) {
  return (
    <div className="grid grid-cols-3 gap-4 mb-6">
      {/* Pending */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800/80 bg-white dark:bg-slate-900/50 p-4 shadow-sm flex flex-col justify-between">
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Pending</p>
        <span className="text-2xl font-extrabold text-slate-700 dark:text-slate-200 mt-2">{pending}</span>
      </div>

      {/* Completed */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800/80 bg-white dark:bg-slate-900/50 p-4 shadow-sm flex flex-col justify-between">
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Completed</p>
        <span className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-2">{completed}</span>
      </div>

      {/* Overdue */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800/80 bg-white dark:bg-slate-900/50 p-4 shadow-sm flex flex-col justify-between">
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Overdue</p>
        <span className="text-2xl font-extrabold text-red-600 dark:text-red-400 mt-2">{overdue}</span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Main Dashboard View Component
// ─────────────────────────────────────────────

export default function HomeDashboard() {
  const { orders, dashboardTasks } = useOrders();
  const [activeTab, setActiveTab] = useState<MainTab>("dashboard");
  const [subTab, setSubTab] = useState<DashboardSubTab>("today");
  const [modalOpen, setModalOpen] = useState(false);

  // Active filter for orders (hiding completed orders > 30 days old)
  const activeOrders = useMemo(() => {
    return orders.filter(o => !isOrderArchived(o));
  }, [orders]);

  // Reference date helpers
  const dates = useMemo(() => {
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);
    const tomorrow = new Date();
    tomorrow.setDate(today.getDate() + 1);

    return {
      todayStr: format(today, "yyyy-MM-dd"),
      yesterdayStr: format(yesterday, "yyyy-MM-dd"),
      tomorrowStr: format(tomorrow, "yyyy-MM-dd"),
      todayLabel: format(today, "EEEE, MMMM d"),
    };
  }, []);

  // Yesterday groupings
  const yesterdayCreations = useMemo(() => activeOrders.filter(o => isCreatedOnDate(o, dates.yesterdayStr)), [activeOrders, dates.yesterdayStr]);
  const yesterdayUpdations = useMemo(() => activeOrders.filter(o => hasTaskOnDate(o, dates.yesterdayStr)), [activeOrders, dates.yesterdayStr]);
  const yesterdayEndings = useMemo(() => activeOrders.filter(o => isEndingOnDate(o, dates.yesterdayStr)), [activeOrders, dates.yesterdayStr]);

  // Today groupings
  const todayCreations = useMemo(() => activeOrders.filter(o => isCreatedOnDate(o, dates.todayStr)), [activeOrders, dates.todayStr]);
  const todayUpdations = useMemo(() => activeOrders.filter(o => hasTaskOnDate(o, dates.todayStr)), [activeOrders, dates.todayStr]);
  const todayEndings = useMemo(() => activeOrders.filter(o => isEndingOnDate(o, dates.todayStr)), [activeOrders, dates.todayStr]);

  // Tomorrow groupings
  const tomorrowUpdations = useMemo(() => activeOrders.filter(o => hasTaskOnDate(o, dates.tomorrowStr)), [activeOrders, dates.tomorrowStr]);
  const tomorrowEndings = useMemo(() => activeOrders.filter(o => isEndingOnDate(o, dates.tomorrowStr)), [activeOrders, dates.tomorrowStr]);

  // Tab Counts helper
  const tabCounts = useMemo(() => {
    const getUniqueCount = (arrs: Order[][]) => {
      const set = new Set<string>();
      arrs.forEach(arr => arr.forEach(o => set.add(o.id)));
      return set.size;
    };
    return {
      yesterday: getUniqueCount([yesterdayCreations, yesterdayUpdations, yesterdayEndings]),
      today: getUniqueCount([todayCreations, todayUpdations, todayEndings]),
      tomorrow: getUniqueCount([tomorrowUpdations, tomorrowEndings]),
    };
  }, [yesterdayCreations, yesterdayUpdations, yesterdayEndings, todayCreations, todayUpdations, todayEndings, tomorrowUpdations, tomorrowEndings]);

  // Tab-specific metrics calculations
  const subTabMetrics = useMemo(() => {
    const calc = (dateStr: string, activeOrdersList: Order[]) => {
      let pending = 0;
      let completed = 0;
      let overdue = 0;

      // Filter to orders relevant for the date (created, updated, or ending on date)
      const dateOrders = activeOrdersList.filter(
        (o) => isCreatedOnDate(o, dateStr) || hasTaskOnDate(o, dateStr) || isEndingOnDate(o, dateStr)
      );

      dateOrders.forEach(o => {
        // Task status record
        const taskRecord = dashboardTasks.find(
          (t) => t.order_id === o.id && t.task_date === dateStr
        );
        const status = taskRecord?.task_status || "not-updated";

        // Count pending / completed client updations due on this day
        if (hasTaskOnDate(o, dateStr)) {
          if (status === "done") {
            completed++;
          } else {
            pending++;
          }
        }

        // Count overdue tasks / orders
        if (o.status === "overdue") {
          overdue++;
        } else if (dateStr < dates.todayStr && hasTaskOnDate(o, dateStr) && status !== "done") {
          overdue++;
        }
      });

      return { pending, completed, overdue };
    };

    return {
      yesterday: calc(dates.yesterdayStr, activeOrders),
      today: calc(dates.todayStr, activeOrders),
      tomorrow: calc(dates.tomorrowStr, activeOrders),
    };
  }, [activeOrders, dashboardTasks, dates]);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col antialiased transition-colors duration-300">
      {/* Top Navigation */}
      <header className="border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 sticky top-0 z-40">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm">
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 3h6M9 3v7l-4.5 9A1 1 0 0 0 5.4 21h13.2a1 1 0 0 0 .9-1.45L15 10V3" />
                <path d="M6.5 15h11" />
              </svg>
            </div>
            <div>
              <h1 className="text-sm font-extrabold leading-none text-slate-800 dark:text-slate-100">Microlabs</h1>
              <p className="mt-0.5 text-[10px] uppercase font-bold tracking-widest text-slate-400">Order Tracker</p>
            </div>
          </div>

          {/* Main sections selection */}
          <nav className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800/60 p-1 rounded-xl">
            {(["dashboard", "orders", "analytics", "settings"] as MainTab[]).map((tab) => {
              const active = activeTab === tab;
              const labels = {
                dashboard: "Dashboard",
                orders: "Orders",
                analytics: "Analytics",
                settings: "Settings",
              };
              return (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 select-none ${active
                      ? "bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm"
                      : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                    }`}
                >
                  {labels[tab]}
                </button>
              );
            })}
          </nav>

          <div className="flex items-center gap-3">
            <span className="hidden text-xs text-slate-400 dark:text-slate-500 sm:block">{dates.todayLabel}</span>
            <button
              id="open-add-order-modal-btn"
              onClick={() => setModalOpen(true)}
              className="flex items-center gap-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 px-4 py-2 text-xs font-bold text-white shadow-md shadow-blue-500/10 active:scale-95 transition-all duration-200"
            >
              <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M8 2v12M2 8h12" />
              </svg>
              New Order
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="mx-auto max-w-6xl w-full px-6 py-8 flex-1 flex flex-col">

        {/* ── SECTION: DASHBOARD ────────────────────────── */}
        {activeTab === "dashboard" && (
          <div className="space-y-6 flex-1 flex flex-col">
            {/* Sub-tabs pills */}
            <div className="flex items-center gap-1.5 border-b border-slate-200 dark:border-slate-800 pb-3">
              {(["yesterday", "today", "tomorrow"] as DashboardSubTab[]).map((tab) => {
                const active = subTab === tab;
                const count = tabCounts[tab];
                const labels = { yesterday: "Yesterday", today: "Today", tomorrow: "Tomorrow" };
                const accents = {
                  yesterday: active ? "border-slate-500 text-slate-600 dark:text-slate-300" : "",
                  today: active ? "border-blue-600 text-blue-600 dark:text-blue-400" : "",
                  tomorrow: active ? "border-violet-600 text-violet-600 dark:text-violet-400" : "",
                };
                return (
                  <button
                    key={tab}
                    onClick={() => setSubTab(tab)}
                    className={`border-b-2 px-3 py-1.5 text-sm font-bold transition-all duration-200 select-none -mb-3.5 flex items-center gap-2 ${active
                        ? `${accents[tab]} border-current`
                        : "border-transparent text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
                      }`}
                  >
                    {labels[tab]}
                    <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold ${active ? "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300" : "bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500"
                      }`}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Dashboard-specific metrics */}
            <TabAnalytics
              pending={subTabMetrics[subTab].pending}
              completed={subTabMetrics[subTab].completed}
              overdue={subTabMetrics[subTab].overdue}
            />

            {/* YESTERDAY VIEW */}
            {subTab === "yesterday" && (
              <div className="space-y-8 flex-1">
                {tabCounts.yesterday === 0 ? (
                  <TabEmpty tab="yesterday" onAdd={() => setModalOpen(true)} />
                ) : (
                  <>
                    {yesterdayCreations.length > 0 && (
                      <div className="space-y-3">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                          <span className="h-2 w-2 rounded-full bg-blue-500" />
                          Creations ({yesterdayCreations.length})
                        </h4>
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                          {yesterdayCreations.map(o => (
                            <DashboardCard key={o.id} order={o} type="creation" dateStr={dates.yesterdayStr} editable={true} />
                          ))}
                        </div>
                      </div>
                    )}

                    {yesterdayUpdations.length > 0 && (
                      <div className="space-y-3">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                          <span className="h-2 w-2 rounded-full bg-violet-500" />
                          Client Updations Due ({yesterdayUpdations.length})
                        </h4>
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                          {yesterdayUpdations.map(o => (
                            <DashboardCard key={o.id} order={o} type="updation" dateStr={dates.yesterdayStr} editable={true} />
                          ))}
                        </div>
                      </div>
                    )}

                    {yesterdayEndings.length > 0 && (
                      <div className="space-y-3">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                          <span className="h-2 w-2 rounded-full bg-amber-500" />
                          Order Endings ({yesterdayEndings.length})
                        </h4>
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                          {yesterdayEndings.map(o => (
                            <DashboardCard key={o.id} order={o} type="ending" dateStr={dates.yesterdayStr} editable={true} />
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* TODAY VIEW */}
            {subTab === "today" && (
              <div className="space-y-8 flex-1">
                {tabCounts.today === 0 ? (
                  <TabEmpty tab="today" onAdd={() => setModalOpen(true)} />
                ) : (
                  <>
                    {todayCreations.length > 0 && (
                      <div className="space-y-3">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                          <span className="h-2 w-2 rounded-full bg-blue-500" />
                          Creations ({todayCreations.length})
                        </h4>
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                          {todayCreations.map(o => (
                            <DashboardCard key={o.id} order={o} type="creation" dateStr={dates.todayStr} editable={true} />
                          ))}
                        </div>
                      </div>
                    )}

                    {todayUpdations.length > 0 && (
                      <div className="space-y-3">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                          <span className="h-2 w-2 rounded-full bg-violet-500" />
                          Client Updations Due Today ({todayUpdations.length})
                        </h4>
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                          {todayUpdations.map(o => (
                            <DashboardCard key={o.id} order={o} type="updation" dateStr={dates.todayStr} editable={true} />
                          ))}
                        </div>
                      </div>
                    )}

                    {todayEndings.length > 0 && (
                      <div className="space-y-3">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                          <span className="h-2 w-2 rounded-full bg-amber-500" />
                          Order Endings Today ({todayEndings.length})
                        </h4>
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                          {todayEndings.map(o => (
                            <DashboardCard key={o.id} order={o} type="ending" dateStr={dates.todayStr} editable={true} />
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* TOMORROW VIEW */}
            {subTab === "tomorrow" && (
              <div className="space-y-8 flex-1">
                {tabCounts.tomorrow === 0 ? (
                  <TabEmpty tab="tomorrow" onAdd={() => setModalOpen(true)} />
                ) : (
                  <>
                    {tomorrowUpdations.length > 0 && (
                      <div className="space-y-3">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                          <span className="h-2 w-2 rounded-full bg-violet-500" />
                          Upcoming Updations ({tomorrowUpdations.length})
                        </h4>
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                          {tomorrowUpdations.map(o => (
                            <DashboardCard key={o.id} order={o} type="updation" dateStr={dates.tomorrowStr} editable={false} />
                          ))}
                        </div>
                      </div>
                    )}

                    {tomorrowEndings.length > 0 && (
                      <div className="space-y-3">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                          <span className="h-2 w-2 rounded-full bg-amber-500" />
                          Order Endings Tomorrow ({tomorrowEndings.length})
                        </h4>
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                          {tomorrowEndings.map(o => (
                            <DashboardCard key={o.id} order={o} type="ending" dateStr={dates.tomorrowStr} editable={false} />
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── SECTION: ORDERS ────────────────────────────── */}
        {activeTab === "orders" && (
          <AllOrdersSection />
        )}

        {/* ── SECTION: ANALYTICS ─────────────────────────── */}
        {activeTab === "analytics" && (
          <MatrixSection />
        )}

        {/* ── SECTION: SETTINGS ──────────────────────────── */}
        {activeTab === "settings" && (
          <SettingsSection />
        )}
      </main>

      {/* Modal */}
      <AddOrderModal isOpen={modalOpen} onClose={() => setModalOpen(false)} />
    </div>
  );
}
