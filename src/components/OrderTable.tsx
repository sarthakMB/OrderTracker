/**
 * OrderTable — displays orders in a table layout.
 *
 * Shows the EmptyState component when there are no orders to display.
 * The table scrolls horizontally on small screens (mobile-friendly).
 */

import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { OrderRow } from "@/components/OrderRow";
import { EmptyState } from "@/components/EmptyState";
import type { Order } from "@/types/order";

interface OrderTableProps {
  /** The orders to display (already filtered and sorted) */
  orders: Order[];
  /** Whether the user has ANY orders at all (for the empty state message) */
  hasAnyOrders: boolean;
  /** Called when the user clicks Edit on an order */
  onEdit: (order: Order) => void;
  /** Called when the user clicks Delete on an order */
  onDelete: (id: string) => void;
}

export function OrderTable({
  orders,
  hasAnyOrders,
  onEdit,
  onDelete,
}: OrderTableProps) {
  // Show empty state if there are no orders to display
  if (orders.length === 0) {
    return <EmptyState hasOrders={hasAnyOrders} />;
  }

  return (
    // overflow-x-auto enables horizontal scrolling on small screens
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Customer</TableHead>
            <TableHead>Description</TableHead>
            <TableHead>Vendor</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Created</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {/*
            .map() loops over the orders array and creates one OrderRow
            for each order. The "key" prop helps React track which rows
            changed — always use a unique identifier (like the order ID).
          */}
          {orders.map((order) => (
            <OrderRow
              key={order.id}
              order={order}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
