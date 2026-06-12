"use client";

import { useMemo } from "react";
import {
  parseISO,
  isWithinInterval,
  addDays,
  startOfToday,
  endOfDay,
  format,
  subMonths,
  startOfMonth,
  endOfMonth,
} from "date-fns";
import { useOrders, type Order, type OrderStatus, isOrderArchived } from "@/components/OrderContext";

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

const ACTIVE_STATUSES: OrderStatus[] = ["pending", "in-progress", "overdue"];

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

function isEndingWithinWeek(order: Order): boolean {
  try {
    const end = parseISO(order.end_date);
    const today = startOfToday();
    const inSevenDays = endOfDay(addDays(today, 7));
    return isWithinInterval(end, { start: today, end: inSevenDays });
  } catch {
    return false;
  }
}

// ─────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────

interface MetricCardProps {
  id: string;
  icon: React.ReactNode;
  label: string;
  value: number;
  sublabel?: string;
  accent: {
    bg: string;
    iconBg: string;
    iconText: string;
    valuText: string;
    ring: string;
  };
}

function MetricCard({ id, icon, label, value, sublabel, accent }: MetricCardProps) {
  return (
    <div
      id={id}
      className={`relative flex flex-col gap-4 overflow-hidden rounded-2xl border bg-white dark:bg-slate-900 p-6 shadow-sm ${accent.ring}`}
    >
      {/* Decorative background blob */}
      <div
        className={`pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full opacity-[0.08] ${accent.iconText}`}
        style={{ background: "currentColor" }}
        aria-hidden="true"
      />

      <div className="flex items-start justify-between gap-4">
        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${accent.iconBg} ${accent.iconText}`}>
          {icon}
        </div>
        <span
          className={`text-4xl font-extrabold tabular-nums leading-none tracking-tight ${accent.valuText}`}
        >
          {value}
        </span>
      </div>

      <div>
        <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">{label}</p>
        {sublabel && (
          <p className="mt-0.5 text-xs text-slate-400 dark:text-slate-500">{sublabel}</p>
        )}
      </div>
    </div>
  );
}

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

function EndingSoonRow({ order, index }: { order: Order; index: number }) {
  const meta = STATUS_META[order.status];
  let endDate: Date | null = null;
  try { endDate = parseISO(order.end_date); } catch { /* skip */ }

  const daysLeft = endDate
    ? Math.max(0, Math.ceil((endDate.getTime() - startOfToday().getTime()) / (1000 * 60 * 60 * 24)))
    : null;

  const urgent = daysLeft !== null && daysLeft <= 2;

  return (
    <tr className={`group transition-colors ${index % 2 === 0 ? "bg-white dark:bg-slate-900" : "bg-slate-50/60 dark:bg-slate-800/40"}`}>
      <td className="py-3 pl-4 pr-2">
        <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate max-w-[200px]">{order.order_name_number}</p>
        <p className="text-[10px] font-mono text-slate-400">{order.id.split("_")[1]}</p>
      </td>
      <td className="py-3 px-2">
        <p className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-[120px]">
          {order.test_name === "Custom" ? order.custom_test_name || "Custom" : order.test_name}
        </p>
      </td>
      <td className="py-3 px-2">
        <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ${meta.badge}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
          {meta.label}
        </span>
      </td>
      <td className="py-3 pl-2 pr-4 text-right">
        <p className="text-xs font-medium text-slate-600 dark:text-slate-400">
          {endDate ? format(endDate, "MMM d") : "—"}
        </p>
        {daysLeft !== null && (
          <p className={`text-[10px] font-semibold ${urgent ? "text-red-500" : "text-slate-400 dark:text-slate-500"}`}>
            {daysLeft === 0 ? "Today!" : daysLeft === 1 ? "Tomorrow" : `${daysLeft}d left`}
          </p>
        )}
      </td>
    </tr>
  );
}

function TableEmpty() {
  return (
    <tr>
      <td colSpan={4} className="py-8 text-center text-xs text-slate-400">
        No orders ending soon.
      </td>
    </tr>
  );
}

// ─────────────────────────────────────────────
// Main MatrixSection component (Analytics)
// ─────────────────────────────────────────────

export default function MatrixSection() {
  const { orders, dashboardTasks } = useOrders();

  const metrics = useMemo(() => {
    const todayStr = format(new Date(), "yyyy-MM-dd");

    // Filter active orders (excluding archived ones)
    const activeOrders = orders.filter((o) => !isOrderArchived(o));

    // 1. Total Active Orders
    const totalActive = activeOrders.filter((o) => ACTIVE_STATUSES.includes(o.status)).length;

    // 2. Total Completed Orders (includes all Completed orders, active or archived, to reflect total work done)
    const totalCompleted = orders.filter((o) => o.status === "completed").length;

    // 3. Orders Ending This Week (next 7 days)
    const endingSoonList = activeOrders.filter(isEndingWithinWeek).sort((a, b) => {
      try {
        return parseISO(a.end_date).getTime() - parseISO(b.end_date).getTime();
      } catch { return 0; }
    });
    const endingWithinWeek = endingSoonList.length;

    // 4. Pending Client Updation (active orders that have a client updation task due today that is not completed)
    const pendingClientUpdation = activeOrders.filter((o) => {
      if (!hasTaskOnDate(o, todayStr)) return false;
      const taskRecord = dashboardTasks.find(
        (t) => t.order_id === o.id && t.task_date === todayStr && t.task_type === "updation"
      );
      return taskRecord?.task_status !== "done";
    }).length;

    // 5. Monthly testing volume (last 6 months)
    const monthlyData = Array.from({ length: 6 }).map((_, i) => {
      const targetMonthDate = subMonths(new Date(), i);
      const label = format(targetMonthDate, "MMM yy");
      const start = startOfMonth(targetMonthDate);
      const end = endOfMonth(targetMonthDate);

      const count = orders.filter((o) => {
        try {
          const created = new Date(o.created_at);
          return created >= start && created <= end;
        } catch {
          return false;
        }
      }).length;

      return { label, count };
    }).reverse();

    const statusBreakdown: Record<OrderStatus, number> = {
      pending: 0,
      "in-progress": 0,
      completed: 0,
      overdue: 0,
    };
    orders.forEach((o) => statusBreakdown[o.status]++);

    return {
      totalActive,
      totalCompleted,
      endingWithinWeek,
      pendingClientUpdation,
      monthlyData,
      endingSoonList,
      statusBreakdown,
    };
  }, [orders, dashboardTasks]);

  const totalOrders = orders.length;

  // Find max volume to scale monthly bar heights
  const maxMonthlyCount = useMemo(() => {
    return Math.max(...metrics.monthlyData.map((d) => d.count), 1);
  }, [metrics.monthlyData]);

  return (
    <section aria-label="Analytics dashboard" className="space-y-8">

      {/* Section heading */}
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-white shadow-sm">
          <svg className="h-4.5 w-4.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6a7.5 7.5 0 107.5 7.5h-7.5V6z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 10.5H21A7.5 7.5 0 0013.5 3v7.5z" />
          </svg>
        </div>
        <div>
          <h2 className="text-base font-bold text-slate-800 dark:text-slate-100">Lab Analytics</h2>
          <p className="text-xs text-slate-400 dark:text-slate-500">Live testing summary & trends</p>
        </div>
      </div>

      {/* ── Metric cards ───────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">

        {/* Total Active Orders */}
        <MetricCard
          id="analytics-total-active"
          label="Total Active Orders"
          value={metrics.totalActive}
          sublabel="Pending, In-Progress, Overdue"
          accent={{
            bg: "bg-blue-50",
            iconBg: "bg-blue-100",
            iconText: "text-blue-600",
            valuText: "text-blue-700 dark:text-blue-400",
            ring: "ring-1 ring-blue-100 dark:ring-blue-900/30",
          }}
          icon={
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 3h6M9 3v7l-4.5 9A1 1 0 0 0 5.4 21h13.2a1 1 0 0 0 .9-1.45L15 10V3" />
            </svg>
          }
        />

        {/* Total Completed Orders */}
        <MetricCard
          id="analytics-total-completed"
          label="Total Completed Orders"
          value={metrics.totalCompleted}
          sublabel="All completed orders"
          accent={{
            bg: "bg-emerald-50",
            iconBg: "bg-emerald-100",
            iconText: "text-emerald-600",
            valuText: "text-emerald-700 dark:text-emerald-400",
            ring: "ring-1 ring-emerald-100 dark:ring-emerald-900/30",
          }}
          icon={
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <path d="M22 4 12 14.01l-3-3" />
            </svg>
          }
        />

        {/* Pending Client Updation */}
        <MetricCard
          id="analytics-pending-updation"
          label="Pending Client Updation"
          value={metrics.pendingClientUpdation}
          sublabel="Due today and not completed"
          accent={{
            bg: "bg-violet-50",
            iconBg: "bg-violet-100",
            iconText: "text-violet-600",
            valuText: "text-violet-700 dark:text-violet-400",
            ring: "ring-1 ring-violet-100 dark:ring-violet-900/30",
          }}
          icon={
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.79 19.79 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
            </svg>
          }
        />

        {/* Orders Ending This Week */}
        <MetricCard
          id="analytics-ending-soon"
          label="Orders Ending This Week"
          value={metrics.endingWithinWeek}
          sublabel="Reaching end date within 7d"
          accent={{
            bg: "bg-amber-50",
            iconBg: "bg-amber-100",
            iconText: "text-amber-600",
            valuText: "text-amber-700 dark:text-amber-400",
            ring: "ring-1 ring-amber-100 dark:ring-amber-900/30",
          }}
          icon={
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
          }
        />
      </div>

      {/* ── Monthly Testing Activity Graph ───────────────── */}
      <div className="rounded-2xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
        <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 mb-6 flex items-center gap-2">
          <svg className="h-4.5 w-4.5 text-blue-500" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
          </svg>
          Monthly Testing Activity
        </h3>

        <div className="h-48 flex items-end justify-between gap-6 px-4 border-b border-slate-100 dark:border-slate-800 pb-1 pt-4">
          {metrics.monthlyData.map((d) => {
            const heightPct = (d.count / maxMonthlyCount) * 100;
            return (
              <div key={d.label} className="flex-1 flex flex-col items-center group relative">
                {/* Bar tooltip */}
                <div className="absolute bottom-full mb-2 bg-slate-800 text-white text-[10px] font-bold px-2 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap shadow-md">
                  {d.count} Order{d.count !== 1 ? "s" : ""}
                </div>

                {/* Animated bar */}
                <div
                  style={{ height: `${heightPct}%` }}
                  className="w-full rounded-t-lg bg-gradient-to-t from-blue-600 to-indigo-500 hover:from-blue-500 hover:to-indigo-400 transition-all duration-500 flex items-end min-h-[4px]"
                />

                {/* Month label */}
                <span className="absolute top-full mt-2 text-[10px] font-semibold text-slate-400 select-none">
                  {d.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Status breakdown bar ───────────────────────── */}
      {totalOrders > 0 && (
        <div className="rounded-2xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
          <h3 className="mb-4 text-xs font-semibold uppercase tracking-widest text-slate-400">
            Active Status Breakdown
          </h3>

          {/* Stacked progress bar */}
          <div className="flex h-3 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
            {(["pending", "in-progress", "completed", "overdue"] as OrderStatus[]).map((s) => {
              const pct = totalOrders > 0 ? (metrics.statusBreakdown[s] / totalOrders) * 100 : 0;
              if (pct === 0) return null;
              const colors: Record<OrderStatus, string> = {
                pending: "bg-amber-400",
                "in-progress": "bg-blue-500",
                completed: "bg-emerald-500",
                overdue: "bg-red-500",
              };
              return (
                <div
                  key={s}
                  className={`${colors[s]} transition-all duration-500`}
                  style={{ width: `${pct}%` }}
                  title={`${STATUS_META[s].label}: ${metrics.statusBreakdown[s]}`}
                />
              );
            })}
          </div>

          {/* Legend */}
          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
            {(["pending", "in-progress", "completed", "overdue"] as OrderStatus[]).map((s) => {
              const meta = STATUS_META[s];
              const count = metrics.statusBreakdown[s];
              if (count === 0) return null;
              return (
                <div key={s} className="flex items-center gap-1.5">
                  <span className={`h-2 w-2 rounded-full ${meta.dot}`} />
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    {meta.label}
                    <span className="ml-1 font-semibold text-slate-700 dark:text-slate-300">{count}</span>
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Ending soon table ──────────────────────────── */}
      <div className="overflow-hidden rounded-2xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
        {/* Table header */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 px-4 py-3.5">
          <div className="flex items-center gap-2">
            <svg className="h-4 w-4 text-amber-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Orders Ending Soon</h3>
          </div>
          {metrics.endingWithinWeek > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700 ring-1 ring-amber-200 dark:bg-amber-950/20 dark:text-amber-300 dark:ring-amber-900/30">
              {metrics.endingWithinWeek} in next 7 days
            </span>
          )}
        </div>

        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40">
              <th className="py-2.5 pl-4 pr-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Order</th>
              <th className="py-2.5 px-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Test Method</th>
              <th className="py-2.5 px-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Status</th>
              <th className="py-2.5 pl-2 pr-4 text-right text-[10px] font-semibold uppercase tracking-wider text-slate-400">Ends</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50">
            {metrics.endingSoonList.length === 0 ? (
              <TableEmpty />
            ) : (
              metrics.endingSoonList.map((order, i) => (
                <EndingSoonRow key={order.id} order={order} index={i} />
              ))
            )}
          </tbody>
        </table>
      </div>

    </section>
  );
}
