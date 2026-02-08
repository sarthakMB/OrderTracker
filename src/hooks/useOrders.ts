/**
 * useOrders — the main custom hook for the app.
 *
 * A "custom hook" is a function that starts with "use" and can call other
 * React hooks (like useState, useMemo). It lets us extract stateful logic
 * out of components and into a reusable function.
 *
 * This hook:
 * 1. Holds ALL the app's state (orders, filters, search)
 * 2. Derives filtered/sorted data from that state
 * 3. Exposes action functions (add, update, delete, filter, search)
 *
 * App.tsx calls this hook once, then passes state and actions down to
 * child components as props. This is the "single source of truth" pattern.
 */

import { useState, useMemo, useCallback } from "react";
import type { Order, OrderFormData, OrderStatus } from "@/types/order";
import * as orderService from "@/services/orderService";
import {
  filterOrdersByStatus,
  searchOrders,
  sortOrdersByDate,
  getOrderCountsByStatus,
} from "@/utils/orderUtils";

/**
 * The return type of useOrders.
 *
 * Defining this interface makes it clear what the hook provides.
 * Components that receive these as props can reference this type.
 */
export interface UseOrdersReturn {
  // State
  orders: Order[];
  filteredOrders: Order[];
  activeStatus: OrderStatus | null;
  searchQuery: string;
  statusCounts: Record<OrderStatus, number>;

  // Actions
  addOrder: (formData: OrderFormData) => void;
  editOrder: (id: string, updates: Partial<OrderFormData>) => void;
  removeOrder: (id: string) => void;
  setActiveStatus: (status: OrderStatus | null) => void;
  setSearchQuery: (query: string) => void;
}

export function useOrders(): UseOrdersReturn {
  // ─── State ───────────────────────────────────────────────────────

  /**
   * useState lets a component "remember" values between renders.
   *
   * The function passed to useState (called "lazy initializer") runs
   * only on the very first render — it loads orders from localStorage
   * once, not on every re-render.
   */
  const [orders, setOrders] = useState<Order[]>(() =>
    orderService.getAllOrders()
  );

  /** Which status tab is currently selected (null = "All") */
  const [activeStatus, setActiveStatus] = useState<OrderStatus | null>(null);

  /** What the user has typed in the search box */
  const [searchQuery, setSearchQuery] = useState("");

  // ─── Derived data ────────────────────────────────────────────────

  /**
   * useMemo caches the result of a calculation and only re-runs it
   * when one of the dependencies (listed in the array) changes.
   *
   * Without useMemo, we'd filter and sort on EVERY render — even if
   * the orders, status, or search query haven't changed. useMemo
   * skips the work when nothing has changed.
   */
  const filteredOrders = useMemo(() => {
    let result = orders;
    result = filterOrdersByStatus(result, activeStatus);
    result = searchOrders(result, searchQuery);
    result = sortOrdersByDate(result);
    return result;
  }, [orders, activeStatus, searchQuery]);

  /** Count orders per status (for the tab badges) */
  const statusCounts = useMemo(
    () => getOrderCountsByStatus(orders),
    [orders]
  );

  // ─── Actions ─────────────────────────────────────────────────────

  /**
   * useCallback caches a function so it doesn't get recreated on every render.
   *
   * This matters when passing functions as props to child components —
   * without useCallback, the child would think it got a "new" function
   * each time and would re-render unnecessarily.
   */

  const addOrder = useCallback((formData: OrderFormData) => {
    const newOrder = orderService.createOrder(formData);
    // Update React state to trigger a re-render with the new order
    setOrders((prev) => [newOrder, ...prev]);
  }, []);

  const editOrder = useCallback(
    (id: string, updates: Partial<OrderFormData>) => {
      const updated = orderService.updateOrder(id, updates);
      if (!updated) return;

      // Replace the old order in state with the updated one
      setOrders((prev) =>
        prev.map((order) => (order.id === id ? updated : order))
      );
    },
    []
  );

  const removeOrder = useCallback((id: string) => {
    const success = orderService.deleteOrder(id);
    if (!success) return;

    // Remove the order from state
    setOrders((prev) => prev.filter((order) => order.id !== id));
  }, []);

  // ─── Return everything the UI needs ──────────────────────────────

  return {
    orders,
    filteredOrders,
    activeStatus,
    searchQuery,
    statusCounts,
    addOrder,
    editOrder,
    removeOrder,
    setActiveStatus,
    setSearchQuery,
  };
}
