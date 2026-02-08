/**
 * OrderForm — the form used to create or edit an order.
 *
 * This component is "controlled" — every input's value comes from React
 * state (the formData prop) and every change goes through onChange.
 * This is the standard React pattern for forms.
 */

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ORDER_STATUS_LIST, STATUS_LABELS } from "@/lib/constants";
import type { OrderFormData, OrderStatus } from "@/types/order";

interface OrderFormProps {
  /** The current form values */
  formData: OrderFormData;
  /**
   * Called whenever any field changes.
   *
   * "Partial<OrderFormData>" means we only send the field(s) that changed,
   * not the entire form. The parent merges it into the full form data.
   */
  onChange: (updates: Partial<OrderFormData>) => void;
}

export function OrderForm({ formData, onChange }: OrderFormProps) {
  return (
    <div className="space-y-4">
      {/* Customer Name — required */}
      <div className="space-y-2">
        <Label htmlFor="customerName">Customer Name *</Label>
        <Input
          id="customerName"
          placeholder="e.g. Rajesh Kumar"
          value={formData.customerName}
          onChange={(e) => onChange({ customerName: e.target.value })}
          required
        />
      </div>

      {/* Customer Contact — optional */}
      <div className="space-y-2">
        <Label htmlFor="customerContact">Contact Info</Label>
        <Input
          id="customerContact"
          placeholder="Phone number or email"
          value={formData.customerContact}
          onChange={(e) => onChange({ customerContact: e.target.value })}
        />
      </div>

      {/* Order Description — required */}
      <div className="space-y-2">
        <Label htmlFor="orderDescription">Order Description *</Label>
        <Textarea
          id="orderDescription"
          placeholder="What needs to be printed?"
          value={formData.orderDescription}
          onChange={(e) => onChange({ orderDescription: e.target.value })}
          required
        />
      </div>

      {/* Vendor Name — optional */}
      <div className="space-y-2">
        <Label htmlFor="vendorName">Vendor</Label>
        <Input
          id="vendorName"
          placeholder="Which vendor is handling this?"
          value={formData.vendorName}
          onChange={(e) => onChange({ vendorName: e.target.value })}
        />
      </div>

      {/* Status — dropdown */}
      <div className="space-y-2">
        <Label htmlFor="status">Status</Label>
        <Select
          value={formData.status}
          onValueChange={(value) => onChange({ status: value as OrderStatus })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ORDER_STATUS_LIST.map((status) => (
              <SelectItem key={status} value={status}>
                {STATUS_LABELS[status]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Notes — optional */}
      <div className="space-y-2">
        <Label htmlFor="notes">Notes</Label>
        <Textarea
          id="notes"
          placeholder="Any additional notes..."
          value={formData.notes}
          onChange={(e) => onChange({ notes: e.target.value })}
        />
      </div>
    </div>
  );
}
