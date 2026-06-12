"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useReducer,
  useRef,
  useState,
} from "react";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export type OrderStatus = "pending" | "in-progress" | "completed" | "overdue";

export interface Order {
  id: string;
  order_name_number: string;
  client_name: string;
  test_name: string;
  custom_test_name?: string;
  test_method: string;
  description: string;
  start_date: string;   // ISO date string "YYYY-MM-DD"
  end_date: string;     // ISO date string "YYYY-MM-DD"
  client_updation_interval: number; // interval in hours
  status: OrderStatus;
  created_at: string;   // ISO timestamp
  updated_at: string;   // ISO timestamp
}

export interface DashboardTask {
  id: string;
  order_id: string;
  task_type: "creation" | "updation" | "ending";
  task_date: string;   // ISO date string "YYYY-MM-DD"
  task_status: "done" | "partial" | "not-updated";
}

export type OrderInput = Omit<Order, "id" | "created_at" | "updated_at">;

export interface ValidationError {
  field: keyof OrderInput;
  message: string;
}

// ─────────────────────────────────────────────
// Archival Logic
// ─────────────────────────────────────────────

/**
 * Returns true if the order is completed and has been updated/completed more than 30 days ago.
 */
export function isOrderArchived(order: Order): boolean {
  if (order.status !== "completed") return false;
  try {
    const completionDate = new Date(order.updated_at);
    const diffMs = new Date().getTime() - completionDate.getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    return diffDays > 30;
  } catch {
    return false;
  }
}

// ─────────────────────────────────────────────
// Validation
// ─────────────────────────────────────────────

function validateOrder(input: OrderInput): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!input.order_name_number || input.order_name_number.trim().length === 0) {
    errors.push({ field: "order_name_number", message: "Order name/number is required." });
  }

  if (!input.client_name || input.client_name.trim().length === 0) {
    errors.push({ field: "client_name", message: "Client name is required." });
  }

  if (!input.test_name || input.test_name.trim().length === 0) {
    errors.push({ field: "test_name", message: "Test name is required." });
  }

  if (input.test_name === "Custom" && (!input.custom_test_name || input.custom_test_name.trim().length === 0)) {
    errors.push({ field: "custom_test_name", message: "Custom test name is required." });
  }

  if (!input.test_method || input.test_method.trim().length === 0) {
    errors.push({ field: "test_method", message: "Test method is required." });
  }

  if (!input.description || input.description.trim().length === 0) {
    errors.push({ field: "description", message: "Description is required." });
  }

  if (!input.start_date) {
    errors.push({ field: "start_date", message: "Start date is required." });
  }

  if (!input.end_date) {
    errors.push({ field: "end_date", message: "End date is required." });
  }

  if (input.start_date && input.end_date && input.start_date > input.end_date) {
    errors.push({ field: "end_date", message: "End date must be on or after the start date." });
  }

  if (
    input.client_updation_interval === undefined ||
    input.client_updation_interval === null ||
    isNaN(input.client_updation_interval)
  ) {
    errors.push({ field: "client_updation_interval", message: "Client updation interval is required." });
  } else if (input.client_updation_interval <= 0) {
    errors.push({ field: "client_updation_interval", message: "Client updation interval must be greater than 0." });
  } else if (!Number.isInteger(input.client_updation_interval)) {
    errors.push({ field: "client_updation_interval", message: "Client updation interval must be a whole number." });
  }

  const validStatuses: OrderStatus[] = ["pending", "in-progress", "completed", "overdue"];
  if (!validStatuses.includes(input.status)) {
    errors.push({ field: "status", message: `Status must be one of: ${validStatuses.join(", ")}.` });
  }

  return errors;
}

// ─────────────────────────────────────────────
// Reducer & State
// ─────────────────────────────────────────────

interface OrderState {
  orders: Order[];
  dashboardTasks: DashboardTask[];
}

type OrderAction =
  | { type: "LOAD"; payload: { orders: Order[]; dashboardTasks: DashboardTask[] } }
  | { type: "ADD"; payload: Order }
  | { type: "UPDATE"; payload: Order }
  | { type: "DELETE"; payload: { id: string } }
  | { type: "SET_TASK_STATUS"; payload: { order_id: string; task_date: string; task_type: "creation" | "updation" | "ending"; task_status: "done" | "partial" | "not-updated" } }
  | { type: "RESET" };

function generateId(): string {
  return `order_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function orderReducer(state: OrderState, action: OrderAction): OrderState {
  switch (action.type) {
    case "LOAD":
      return { orders: action.payload.orders, dashboardTasks: action.payload.dashboardTasks };
    case "ADD":
      return { ...state, orders: [...state.orders, action.payload] };
    case "UPDATE":
      return {
        ...state,
        orders: state.orders.map((o) =>
          o.id === action.payload.id ? action.payload : o
        ),
      };
    case "DELETE":
      return {
        orders: state.orders.filter((o) => o.id !== action.payload.id),
        dashboardTasks: state.dashboardTasks.filter((t) => t.order_id !== action.payload.id),
      };
    case "SET_TASK_STATUS": {
      const { order_id, task_date, task_type, task_status } = action.payload;
      const existingIdx = state.dashboardTasks.findIndex(
        (t) => t.order_id === order_id && t.task_date === task_date && t.task_type === task_type
      );
      let updatedTasks = [...state.dashboardTasks];
      if (existingIdx >= 0) {
        updatedTasks[existingIdx] = { ...updatedTasks[existingIdx], task_status };
      } else {
        updatedTasks.push({
          id: `task_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
          order_id,
          task_type,
          task_date,
          task_status,
        });
      }
      return { ...state, dashboardTasks: updatedTasks };
    }
    case "RESET":
      return { orders: [], dashboardTasks: [] };
    default:
      return state;
  }
}

// ─────────────────────────────────────────────
// Context
// ─────────────────────────────────────────────

export interface DeleteConfirmation {
  orderId: string;
  orderName: string;
  /** Call this to confirm deletion. */
  confirm: () => void;
  /** Call this to cancel deletion. */
  cancel: () => void;
}

interface OrderContextValue {
  orders: Order[];
  dashboardTasks: DashboardTask[];

  /**
   * Add a new order. Runs validation first.
   * @returns The created Order, or throws a ValidationError[].
   */
  addOrder: (input: OrderInput) => Order;

  /**
   * Update an existing order. Runs validation first.
   * @returns The updated Order, or throws a ValidationError[].
   */
  updateOrder: (id: string, input: Partial<OrderInput>) => Order;

  /**
   * Initiate a double-confirmation delete flow.
   * The caller receives a `DeleteConfirmation` object; the actual
   * deletion only happens when `confirm()` is called a second time.
   * `pendingDelete` in context reflects the waiting state.
   */
  requestDeleteOrder: (id: string) => DeleteConfirmation | null;

  /** The deletion waiting for second confirmation (null if none). */
  pendingDelete: Omit<DeleteConfirmation, "confirm" | "cancel"> | null;

  /** Cancel any in-progress delete confirmation. */
  cancelDelete: () => void;

  /** Convenience: get a single order by id. */
  getOrder: (id: string) => Order | undefined;

  /**
   * Updates or creates a status record for a dashboard task.
   */
  setTaskStatus: (
    orderId: string,
    taskDate: string,
    taskType: "creation" | "updation" | "ending",
    status: "done" | "partial" | "not-updated"
  ) => void;
}

const OrderContext = createContext<OrderContextValue | null>(null);

// ─────────────────────────────────────────────
// Provider
// ─────────────────────────────────────────────

const LOCAL_STORAGE_KEY = "order_tracker_orders";
const LOCAL_STORAGE_TASKS_KEY = "order_tracker_dashboard_tasks";

export function OrderProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(orderReducer, { orders: [], dashboardTasks: [] });
  const [pendingDelete, setPendingDelete] = useState<{
    orderId: string;
    orderName: string;
  } | null>(null);

  // Track whether initial load from localStorage is done.
  const hydrated = useRef(false);

  // ── Load from localStorage on mount ──────────────────────────────────
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const rawOrders = localStorage.getItem(LOCAL_STORAGE_KEY);
      const rawTasks = localStorage.getItem(LOCAL_STORAGE_TASKS_KEY);
      
      let loadedOrders: Order[] = [];
      let loadedTasks: DashboardTask[] = [];

      if (rawOrders) {
        const parsed = JSON.parse(rawOrders);
        if (Array.isArray(parsed)) {
          loadedOrders = parsed.map((item: any) => {
            const client_updation_interval =
              typeof item.client_updation_interval === "number"
                ? item.client_updation_interval
                : typeof item.client_updation_interval_hours === "number"
                ? item.client_updation_interval_hours
                : typeof item.clientUpdationInterval === "number"
                ? item.clientUpdationInterval / 60
                : typeof item.photoInterval === "number"
                ? item.photoInterval / 60
                : 24; // fallback default
                
            let status = item.status;
            if (status === "cancelled") {
              status = "pending";
            }
            if (!["pending", "in-progress", "completed", "overdue"].includes(status)) {
              status = "pending";
            }

            return {
              id: item.id || generateId(),
              order_name_number: item.order_name_number || item.orderNameNumber || item.orderName || "Unnamed Order",
              client_name: item.client_name || item.clientName || "Microlabs Client",
              test_name: item.test_name || item.testName || "Quality Analysis",
              custom_test_name: item.custom_test_name || item.customTestName || "",
              test_method: item.test_method || item.testMethod || "",
              description: item.description || "",
              start_date: item.start_date || item.startDate || new Date().toISOString().slice(0, 10),
              end_date: item.end_date || item.endDate || new Date().toISOString().slice(0, 10),
              client_updation_interval,
              status: status as OrderStatus,
              created_at: item.created_at || item.createdAt || new Date().toISOString(),
              updated_at: item.updated_at || item.updatedAt || new Date().toISOString(),
            };
          });

          // Generate dynamic tasks status history migration if no tasks table is stored
          if (!rawTasks) {
            parsed.forEach((item: any) => {
              const dates = item.client_updation_dates || item.clientUpdationDates || [];
              dates.forEach((d: string) => {
                loadedTasks.push({
                  id: `task_mig_${Math.random().toString(36).slice(2, 9)}`,
                  order_id: item.id,
                  task_type: "updation",
                  task_date: d,
                  task_status: "done",
                });
              });
            });
          }
        }
      }

      if (rawTasks) {
        const parsed = JSON.parse(rawTasks);
        if (Array.isArray(parsed)) {
          loadedTasks = parsed;
        }
      }

      dispatch({ type: "LOAD", payload: { orders: loadedOrders, dashboardTasks: loadedTasks } });
    } catch {
      // fresh start
    } finally {
      hydrated.current = true;
    }
  }, []);

  // ── Persist to localStorage whenever orders change ────────────────────
  useEffect(() => {
    if (!hydrated.current) return;
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(state.orders));
      localStorage.setItem(LOCAL_STORAGE_TASKS_KEY, JSON.stringify(state.dashboardTasks));
    } catch {
      // Storage quota or private-mode failure — ignore.
    }
  }, [state.orders, state.dashboardTasks]);

  // ── addOrder ──────────────────────────────────────────────────────────
  const addOrder = useCallback((input: OrderInput): Order => {
    const errors = validateOrder(input);
    if (errors.length > 0) {
      throw errors;
    }
    const now = new Date().toISOString();
    const newOrder: Order = {
      id: generateId(),
      order_name_number: input.order_name_number.trim(),
      client_name: input.client_name.trim(),
      test_name: input.test_name.trim(),
      custom_test_name: input.custom_test_name ? input.custom_test_name.trim() : undefined,
      test_method: input.test_method.trim(),
      description: input.description.trim(),
      start_date: input.start_date,
      end_date: input.end_date,
      client_updation_interval: input.client_updation_interval,
      status: input.status,
      created_at: now,
      updated_at: now,
    };
    dispatch({ type: "ADD", payload: newOrder });
    return newOrder;
  }, []);

  // ── updateOrder ───────────────────────────────────────────────────────
  const updateOrder = useCallback(
    (id: string, input: Partial<OrderInput>): Order => {
      const existing = state.orders.find((o) => o.id === id);
      if (!existing) {
        throw new Error(`Order with id "${id}" not found.`);
      }
      const merged: OrderInput = {
        order_name_number: input.order_name_number ?? existing.order_name_number,
        client_name: input.client_name ?? existing.client_name,
        test_name: input.test_name ?? existing.test_name,
        custom_test_name: input.custom_test_name !== undefined ? input.custom_test_name : existing.custom_test_name,
        test_method: input.test_method ?? existing.test_method,
        description: input.description ?? existing.description,
        start_date: input.start_date ?? existing.start_date,
        end_date: input.end_date ?? existing.end_date,
        client_updation_interval: input.client_updation_interval ?? existing.client_updation_interval,
        status: input.status ?? existing.status,
      };
      const errors = validateOrder(merged);
      if (errors.length > 0) {
        throw errors;
      }
      const updated: Order = {
        ...existing,
        ...merged,
        order_name_number: merged.order_name_number.trim(),
        client_name: merged.client_name.trim(),
        test_name: merged.test_name.trim(),
        custom_test_name: merged.custom_test_name ? merged.custom_test_name.trim() : undefined,
        description: merged.description.trim(),
        updated_at: new Date().toISOString(),
      };
      dispatch({ type: "UPDATE", payload: updated });
      return updated;
    },
    [state.orders]
  );

  // ── requestDeleteOrder (double-confirmation) ──────────────────────────
  const requestDeleteOrder = useCallback(
    (id: string): DeleteConfirmation | null => {
      const order = state.orders.find((o) => o.id === id);
      if (!order) return null;

      const confirmation: DeleteConfirmation = {
        orderId: id,
        orderName: order.order_name_number,
        confirm: () => {
          dispatch({ type: "DELETE", payload: { id } });
          setPendingDelete(null);
        },
        cancel: () => {
          setPendingDelete(null);
        },
      };

      setPendingDelete({ orderId: id, orderName: order.order_name_number });
      return confirmation;
    },
    [state.orders]
  );

  // ── cancelDelete ──────────────────────────────────────────────────────
  const cancelDelete = useCallback(() => {
    setPendingDelete(null);
  }, []);

  // ── getOrder ──────────────────────────────────────────────────────────
  const getOrder = useCallback(
    (id: string): Order | undefined => state.orders.find((o) => o.id === id),
    [state.orders]
  );

  // ── setTaskStatus ─────────────────────────────────────────────────────
  const setTaskStatus = useCallback(
    (
      order_id: string,
      task_date: string,
      task_type: "creation" | "updation" | "ending",
      task_status: "done" | "partial" | "not-updated"
    ): void => {
      dispatch({ type: "SET_TASK_STATUS", payload: { order_id, task_date, task_type, task_status } });
    },
    []
  );

  const value: OrderContextValue = {
    orders: state.orders,
    dashboardTasks: state.dashboardTasks,
    addOrder,
    updateOrder,
    requestDeleteOrder,
    pendingDelete,
    cancelDelete,
    getOrder,
    setTaskStatus,
  };

  return <OrderContext.Provider value={value}>{children}</OrderContext.Provider>;
}

// ─────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────

export function useOrders(): OrderContextValue {
  const ctx = useContext(OrderContext);
  if (!ctx) {
    throw new Error("useOrders must be used inside an <OrderProvider>.");
  }
  return ctx;
}
