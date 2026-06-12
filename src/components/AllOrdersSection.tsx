"use client";

import { useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { useOrders, type Order, type OrderStatus, isOrderArchived } from "@/components/OrderContext";

// ─────────────────────────────────────────────
// Status metadata
// ─────────────────────────────────────────────

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
  const m = STATUS_META[status];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ${m.badge}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${m.dot}`} />
      {m.label}
    </span>
  );
}

// ─────────────────────────────────────────────
// Dynamic Task calculation (for date search)
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

// ─────────────────────────────────────────────
// Order Card Component with Expandable Details & 2-Step Delete
// ─────────────────────────────────────────────

function OrderCard({ order, highlightedEvents }: { order: Order; highlightedEvents?: string[] }) {
  const { requestDeleteOrder } = useOrders();
  const [expanded, setExpanded] = useState(false);
  const [deleteState, setDeleteState] = useState<"idle" | "step1" | "step2">("idle");

  function handleDeleteClick(e: React.MouseEvent) {
    e.stopPropagation(); // prevent card expand toggle
    setDeleteState("step1");
  }

  function handleConfirmStep1(e: React.MouseEvent) {
    e.stopPropagation();
    setDeleteState("step2");
  }

  function handleConfirmYes(e: React.MouseEvent) {
    e.stopPropagation();
    const conf = requestDeleteOrder(order.id);
    conf?.confirm();
  }

  function handleConfirmNo(e: React.MouseEvent) {
    e.stopPropagation();
    setDeleteState("idle");
  }

  return (
    <article
      onClick={() => setExpanded(!expanded)}
      className={`relative flex flex-col rounded-2xl border bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 p-5 shadow-sm transition hover:shadow-md cursor-pointer select-none ${
        expanded ? "ring-2 ring-blue-500 dark:ring-blue-600/60" : "ring-1 ring-slate-900/[0.04]"
      }`}
    >
      {/* Event highlights from Date Search */}
      {highlightedEvents && highlightedEvents.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-1">
          {highlightedEvents.map((evt) => (
            <span
              key={evt}
              className="inline-flex items-center gap-1 rounded-full bg-blue-50 dark:bg-blue-950/20 px-2 py-0.5 text-[10px] font-bold text-blue-700 dark:text-blue-300 ring-1 ring-blue-100 dark:ring-blue-900/30"
            >
              {evt}
            </span>
          ))}
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">
            {order.order_name_number}
          </h3>
          <p className="mt-0.5 text-xs font-semibold text-slate-500 dark:text-slate-400">
            Client: <span className="text-slate-700 dark:text-slate-300">{order.client_name}</span>
          </p>
        </div>
        <StatusBadge status={order.status} />
      </div>

      {/* Primary fields shown always */}
      <div className="mt-3 text-xs flex justify-between items-center text-slate-400">
        <p className="font-semibold text-slate-600 dark:text-slate-400">
          Test: <span className="text-slate-800 dark:text-slate-200">{order.test_name}</span>
        </p>
        <span className="text-[10px] text-blue-500 font-semibold hover:underline">
          {expanded ? "Collapse details" : "Click to view details"}
        </span>
      </div>

      {/* Expanded Details section */}
      {expanded && (
        <div className="mt-4 border-t border-slate-100 dark:border-slate-800/60 pt-4 space-y-4 animate-fadeIn">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-xs">
            <div>
              <dt className="font-medium uppercase tracking-wide text-slate-400">Method</dt>
              <dd className="mt-0.5 truncate text-slate-700 dark:text-slate-300">
                {order.test_method === "Custom" ? order.custom_test_name || "Custom" : order.test_method}
              </dd>
            </div>
            <div>
              <dt className="font-medium uppercase tracking-wide text-slate-400">Updation Interval</dt>
              <dd className="mt-0.5 text-slate-700 dark:text-slate-300">{order.client_updation_interval} hrs</dd>
            </div>
            <div>
              <dt className="font-medium uppercase tracking-wide text-slate-400">Start Date</dt>
              <dd className="mt-0.5 text-slate-700 dark:text-slate-300">{order.start_date}</dd>
            </div>
            <div>
              <dt className="font-medium uppercase tracking-wide text-slate-400">End Date</dt>
              <dd className="mt-0.5 text-slate-700 dark:text-slate-300">{order.end_date}</dd>
            </div>
            {order.description && (
              <div className="col-span-2">
                <dt className="font-medium uppercase tracking-wide text-slate-400">Description</dt>
                <dd className="mt-0.5 text-slate-600 dark:text-slate-400 whitespace-pre-wrap">{order.description}</dd>
              </div>
            )}
          </dl>

          {/* Footer: delete button */}
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800/60 flex justify-end">
            {deleteState === "idle" && (
              <button
                onClick={handleDeleteClick}
                className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-red-500 transition-colors py-1 px-2.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/20"
              >
                <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                </svg>
                Delete
              </button>
            )}

            {deleteState === "step1" && (
              <button
                onClick={handleConfirmStep1}
                className="text-xs font-bold text-red-600 hover:bg-red-100/50 bg-red-50 dark:bg-red-950/20 dark:text-red-400 px-3 py-1.5 rounded-lg animate-pulse"
              >
                Delete Order?
              </button>
            )}

            {deleteState === "step2" && (
              <div className="flex items-center gap-2 rounded-xl bg-red-50 dark:bg-red-950/20 px-3 py-1.5 ring-1 ring-red-100 dark:ring-red-900/30">
                <p className="text-xs font-semibold text-red-700 dark:text-red-300 mr-2">Are you sure?</p>
                <button
                  onClick={handleConfirmYes}
                  className="rounded-md bg-red-600 text-white px-2.5 py-1 text-[11px] font-bold shadow-sm shadow-red-500/10 hover:bg-red-700 transition"
                >
                  Yes
                </button>
                <button
                  onClick={handleConfirmNo}
                  className="rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2.5 py-1 text-[11px] font-bold shadow-sm"
                >
                  No
                </button>
              </div>
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

function EmptyState({ filtered }: { filtered: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-800 py-20 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500">
        <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
      </div>
      <div>
        <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
          {filtered ? "No orders match your search parameters" : "No orders active"}
        </p>
        <p className="mt-1 text-xs text-slate-400">
          {filtered ? "Try refining your name/number search or selected date filter." : "Create your first quality testing order."}
        </p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Main AllOrdersSection Component
// ─────────────────────────────────────────────

export default function AllOrdersSection() {
  const { orders } = useOrders();

  const [nameQuery, setNameQuery] = useState("");
  const [dateFilter, setDateFilter] = useState("");

  // Filter completed orders older than 30 days
  const activeOrders = useMemo(() => {
    return orders.filter(o => !isOrderArchived(o));
  }, [orders]);

  // Handle Search by Name / Number
  const matchesName = (order: Order, query: string): boolean => {
    if (!query.trim()) return true;
    return order.order_name_number.toLowerCase().includes(query.trim().toLowerCase());
  };

  // Handle Search by Date (Shows items starting, ending, or with updation tasks on date)
  const matchesDate = (order: Order, date: string): boolean => {
    if (!date) return true;
    return (
      order.start_date === date ||
      order.end_date === date ||
      hasTaskOnDate(order, date)
    );
  };

  const filteredOrders = useMemo(() => {
    return activeOrders.filter((o) => matchesName(o, nameQuery) && matchesDate(o, dateFilter));
  }, [activeOrders, nameQuery, dateFilter]);

  const isFiltering = nameQuery.trim() !== "" || dateFilter !== "";

  // Highlight specific events for date searching
  const getHighlightedEvents = (order: Order, date: string): string[] => {
    if (!date) return [];
    const events: string[] = [];
    if (order.start_date === date) events.push("Starts Today");
    if (order.end_date === date) events.push("Ends Today");
    if (hasTaskOnDate(order, date)) events.push("Client Updation Due");
    return events;
  };

  return (
    <section aria-label="All Orders" className="space-y-6">
      {/* Heading */}
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white shadow-sm">
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="8" y1="6" x2="21" y2="6" />
            <line x1="8" y1="12" x2="21" y2="12" />
            <line x1="8" y1="18" x2="21" y2="18" />
            <line x1="3" y1="6" x2="3.01" y2="6" />
            <line x1="3" y1="12" x2="3.01" y2="12" />
            <line x1="3" y1="18" x2="3.01" y2="18" />
          </svg>
        </div>
        <div>
          <h2 className="text-base font-bold text-slate-800 dark:text-slate-100">All Orders</h2>
          <p className="text-xs text-slate-400 dark:text-slate-500">
            {activeOrders.length} active order{activeOrders.length !== 1 ? "s" : ""} total
            {isFiltering && ` · ${filteredOrders.length} matching`}
          </p>
        </div>
      </div>

      {/* Search Bar Group */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl shadow-sm">
        
        {/* Search by Name/Number */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="search-name" className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Search by Order Name / Number
          </label>
          <div className="relative">
            <svg
              className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
              viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
            >
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              id="search-name"
              type="text"
              placeholder="Ex: TOCR Number"
              value={nameQuery}
              onChange={(e) => setNameQuery(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 dark:bg-slate-800/40 dark:border-slate-800 dark:text-slate-100 py-2.5 pl-9 pr-4 text-sm outline-none transition focus:border-blue-400 focus:bg-white dark:focus:bg-slate-900"
            />
          </div>
        </div>

        {/* Search by Date */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="search-date" className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Search by Date (Events & Reminders)
          </label>
          <div className="relative">
            <svg
              className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
              viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
            >
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
            <input
              id="search-date"
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 dark:bg-slate-800/40 dark:border-slate-800 dark:text-slate-100 py-2.5 pl-9 pr-4 text-sm outline-none transition focus:border-blue-400 focus:bg-white dark:focus:bg-slate-900"
            />
          </div>
        </div>
      </div>

      {/* Orders Grid */}
      {filteredOrders.length === 0 ? (
        <EmptyState filtered={isFiltering} />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredOrders.map((order) => (
            <OrderCard
              key={order.id}
              order={order}
              highlightedEvents={getHighlightedEvents(order, dateFilter)}
            />
          ))}
        </div>
      )}
    </section>
  );
}
