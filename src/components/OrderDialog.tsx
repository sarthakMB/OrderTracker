/**
 * OrderDialog — a modal dialog that wraps OrderForm for creating/editing orders.
 *
 * "Dialog" is a UI pattern where a popup appears on top of the page,
 * dimming the background. The user fills in the form and clicks Save or Cancel.
 *
 * This component manages its own form state internally. When the user clicks
 * Save, it sends the final form data up to the parent via onSave.
 */

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { OrderForm } from "@/components/OrderForm";
import type { Order, OrderFormData } from "@/types/order";

interface OrderDialogProps {
  /** Whether the dialog is currently visible */
  isOpen: boolean;
  /** Called when the dialog should close (user clicks X, Cancel, or outside) */
  onClose: () => void;
  /** Called when the user clicks Save with valid form data */
  onSave: (formData: OrderFormData) => void;
  /**
   * If editing an existing order, pass it here.
   * If creating a new order, leave this undefined.
   */
  orderToEdit?: Order;
}

/** Default values for a brand-new order form */
const EMPTY_FORM: OrderFormData = {
  customerName: "",
  customerContact: "",
  orderDescription: "",
  vendorName: "",
  status: "new",
  notes: "",
};

export function OrderDialog({
  isOpen,
  onClose,
  onSave,
  orderToEdit,
}: OrderDialogProps) {
  /**
   * The form's internal state.
   *
   * We use local state here (not the parent's state) because the form
   * data is "in progress" — we don't want to save partial edits.
   * Only when the user clicks Save do we send it up.
   */
  const [formData, setFormData] = useState<OrderFormData>(EMPTY_FORM);

  /**
   * useEffect runs code when something changes.
   *
   * Here, when the dialog opens (isOpen changes to true), we either:
   * - Fill the form with the existing order's data (if editing)
   * - Reset to empty (if creating new)
   */
  useEffect(() => {
    if (isOpen) {
      if (orderToEdit) {
        // Editing: populate form with existing order data
        setFormData({
          customerName: orderToEdit.customerName,
          customerContact: orderToEdit.customerContact,
          orderDescription: orderToEdit.orderDescription,
          vendorName: orderToEdit.vendorName,
          status: orderToEdit.status,
          notes: orderToEdit.notes,
        });
      } else {
        // Creating: start with empty form
        setFormData(EMPTY_FORM);
      }
    }
  }, [isOpen, orderToEdit]);

  /**
   * Handle form field changes.
   *
   * The spread operator (...prev) copies all existing form data,
   * then the updates override specific fields.
   */
  function handleFormChange(updates: Partial<OrderFormData>) {
    setFormData((prev) => ({ ...prev, ...updates }));
  }

  function handleSave() {
    // Basic validation — customer name and description are required
    if (!formData.customerName.trim() || !formData.orderDescription.trim()) {
      return;
    }

    onSave(formData);
    onClose();
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {orderToEdit ? "Edit Order" : "New Order"}
          </DialogTitle>
        </DialogHeader>

        <OrderForm formData={formData} onChange={handleFormChange} />

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
