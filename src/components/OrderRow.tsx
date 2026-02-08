/**
 * OrderRow — a single row in the orders table.
 *
 * Shows the order's key info and action buttons (Edit, Delete).
 */

import { TableRow, TableCell } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { OrderStatusBadge } from "@/components/OrderStatusBadge";
import type { Order } from "@/types/order";

interface OrderRowProps {
  order: Order;
  /** Called when the user clicks the Edit button */
  onEdit: (order: Order) => void;
  /** Called when the user clicks the Delete button */
  onDelete: (id: string) => void;
}

export function OrderRow({ order, onEdit, onDelete }: OrderRowProps) {
  /**
   * Format a date string into a short, readable format.
   *
   * new Date() parses the ISO string, then toLocaleDateString() formats it
   * based on the user's locale (e.g. "1/15/2025" in US, "15/1/2025" in UK).
   */
  const formattedDate = new Date(order.createdAt).toLocaleDateString(
    undefined,
    {
      month: "short",
      day: "numeric",
      year: "numeric",
    }
  );

  return (
    <TableRow>
      <TableCell className="font-medium">{order.customerName}</TableCell>
      <TableCell>{order.orderDescription}</TableCell>
      <TableCell>{order.vendorName || "—"}</TableCell>
      <TableCell>
        <OrderStatusBadge status={order.status} />
      </TableCell>
      <TableCell className="text-muted-foreground">{formattedDate}</TableCell>
      <TableCell>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => onEdit(order)}>
            Edit
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onDelete(order.id)}
            className="text-destructive hover:text-destructive"
          >
            Delete
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}
