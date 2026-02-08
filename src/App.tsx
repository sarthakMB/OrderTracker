/**
 * App — the root component that wires everything together.
 *
 * This is where the "props down, callbacks up" pattern happens:
 * 1. useOrders hook provides state and actions
 * 2. App passes state DOWN to child components as props
 * 3. Child components call action callbacks UP when the user interacts
 *
 * App also manages the dialog (open/close) state since both the header
 * button and the edit button in each row need to open it.
 */

import { useState } from "react";
import { useOrders } from "@/hooks/useOrders";
import { AppHeader } from "@/components/AppHeader";
import { OrderFilters } from "@/components/OrderFilters";
import { OrderTable } from "@/components/OrderTable";
import { OrderDialog } from "@/components/OrderDialog";
import { toast } from "sonner";
import type { Order, OrderFormData } from "@/types/order";

function App() {
  // ─── App state from the custom hook ──────────────────────────────

  const {
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
  } = useOrders();

  // ─── Dialog state ────────────────────────────────────────────────

  /** Whether the create/edit dialog is currently open */
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  /**
   * The order being edited (if any).
   * - undefined means "creating a new order"
   * - an Order object means "editing that order"
   */
  const [orderToEdit, setOrderToEdit] = useState<Order | undefined>(undefined);

  // ─── Dialog actions ──────────────────────────────────────────────

  /** Open dialog for creating a new order */
  function handleNewOrder() {
    setOrderToEdit(undefined);
    setIsDialogOpen(true);
  }

  /** Open dialog for editing an existing order */
  function handleEditOrder(order: Order) {
    setOrderToEdit(order);
    setIsDialogOpen(true);
  }

  /**
   * Handle saving from the dialog (works for both create and edit).
   *
   * Now async because addOrder/editOrder talk to the backend API.
   * Wrapped in try/catch to show an error toast if the request fails.
   */
  async function handleSaveOrder(formData: OrderFormData) {
    try {
      if (orderToEdit) {
        await editOrder(orderToEdit.id, formData);
        toast.success("Order updated");
      } else {
        await addOrder(formData);
        toast.success("Order created");
      }
    } catch (error) {
      toast.error("Failed to save order. Please try again.");
      console.error("Save order error:", error);
    }
  }

  /** Handle deleting an order — async with error handling */
  async function handleDeleteOrder(id: string) {
    try {
      await removeOrder(id);
      toast.success("Order deleted");
    } catch (error) {
      toast.error("Failed to delete order. Please try again.");
      console.error("Delete order error:", error);
    }
  }

  // ─── Render ──────────────────────────────────────────────────────

  return (
    <div className="mx-auto min-h-screen max-w-5xl">
      {/* Header with "New Order" button */}
      <AppHeader onNewOrder={handleNewOrder} />

      {/* Status tabs + search input */}
      <OrderFilters
        activeStatus={activeStatus}
        searchQuery={searchQuery}
        statusCounts={statusCounts}
        totalOrders={orders.length}
        onStatusChange={setActiveStatus}
        onSearchChange={setSearchQuery}
      />

      {/* Orders table (or empty state) */}
      <div className="px-4 py-4 sm:px-6">
        <OrderTable
          orders={filteredOrders}
          hasAnyOrders={orders.length > 0}
          isLoading={isLoading}
          onEdit={handleEditOrder}
          onDelete={handleDeleteOrder}
        />
      </div>

      {/* Create / Edit dialog */}
      <OrderDialog
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        onSave={handleSaveOrder}
        orderToEdit={orderToEdit}
      />
    </div>
  );
}

export default App;
