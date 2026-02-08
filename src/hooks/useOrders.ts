/**
 * useOrders — the main custom hook for the app.
 *
 * A "custom hook" is a function that starts with "use" and can call other
 * React hooks (like useState, useMemo). It lets us extract stateful logic
 * out of components and into a reusable function.
 *
 * This hook:
 * 1. Holds ALL the app's state (orders, filters, search, loading)
 * 2. Loads orders from the backend API on mount
 * 3. Derives filtered/sorted data from that state
 * 4. Exposes async action functions (add, update, delete, filter, search)
 *
 * App.tsx calls this hook once, then passes state and actions down to
 * child components as props. This is the "single source of truth" pattern.
 */

import { useState, useMemo, useCallback, useEffect } from "react";
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
 *
 * Note: addOrder, editOrder, removeOrder are now async (return Promises)
 * because they talk to the backend API.
 */
export interface UseOrdersReturn {
  // State
  orders: Order[];
  filteredOrders: Order[];
  activeStatus: OrderStatus | null;
  searchQuery: string;
  statusCounts: Record<OrderStatus, number>;
  /** True while orders are being loaded from the server */
  isLoading: boolean;

  // Actions (async — they talk to the backend)
  addOrder: (formData: OrderFormData) => Promise<void>;
  editOrder: (id: string, updates: Partial<OrderFormData>) => Promise<void>;
  removeOrder: (id: string) => Promise<void>;
  setActiveStatus: (status: OrderStatus | null) => void;
  setSearchQuery: (query: string) => void;
}

export function useOrders(): UseOrdersReturn {
  // ─── State ───────────────────────────────────────────────────────

  /**
   * Orders start as an empty array. We load them from the API in useEffect
   * below. (Previously, we loaded from localStorage in a lazy initializer,
   * but API calls are async so we can't do that in useState.)
   */
  const [orders, setOrders] = useState<Order[]>([]);

  /** True while we're fetching orders from the server */
  const [isLoading, setIsLoading] = useState(true);

  /** Which status tab is currently selected (null = "All") */
  const [activeStatus, setActiveStatus] = useState<OrderStatus | null>(null);

  /** What the user has typed in the search box */
  const [searchQuery, setSearchQuery] = useState("");

  // ─── Initial data load ─────────────────────────────────────────

  /**
   * useEffect runs code AFTER the component renders.
   *
   * The empty array [] as the second argument means "run this only once,
   * when the component first mounts" (like componentDidMount in class components).
   *
   * We fetch all orders from the backend API, then update state.
   */
  useEffect(() => {
    orderService
      .getAllOrders()
      .then((data) => setOrders(data))
      .catch((error) => {
        // Log the error for debugging — the UI will just show empty state
        console.error("Failed to load orders:", error);
      })
      .finally(() => setIsLoading(false));
  }, []);

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
   * These actions are now async because they call the backend API.
   * They throw errors on failure — the caller (App.tsx) catches them
   * and shows error toasts.
   *
   * useCallback caches a function so it doesn't get recreated on every render.
   * This matters when passing functions as props to child components.
   */

  const addOrder = useCallback(async (formData: OrderFormData) => {
    // Call the API — it returns the complete order with id + timestamps
    const newOrder = await orderService.createOrder(formData);
    // Add to the front of the list (newest first)
    setOrders((prev) => [newOrder, ...prev]);
  }, []);

  const editOrder = useCallback(
    async (id: string, updates: Partial<OrderFormData>) => {
      const updated = await orderService.updateOrder(id, updates);
      if (!updated) return;

      // Replace the old order in state with the updated one
      setOrders((prev) =>
        prev.map((order) => (order.id === id ? updated : order))
      );
    },
    []
  );

  const removeOrder = useCallback(async (id: string) => {
    const success = await orderService.deleteOrder(id);
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
    isLoading,
    addOrder,
    editOrder,
    removeOrder,
    setActiveStatus,
    setSearchQuery,
  };
}
