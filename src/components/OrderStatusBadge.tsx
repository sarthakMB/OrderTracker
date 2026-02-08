/**
 * OrderStatusBadge — a small colored pill showing the order's status.
 *
 * Uses shadcn's Badge component with custom colors from our constants.
 */

import { Badge } from "@/components/ui/badge";
import { STATUS_LABELS, STATUS_COLORS } from "@/lib/constants";
import type { OrderStatus } from "@/types/order";

interface OrderStatusBadgeProps {
  status: OrderStatus;
}

export function OrderStatusBadge({ status }: OrderStatusBadgeProps) {
  return (
    <Badge
      variant="secondary"
      // cn() from shadcn merges class names safely, but here we just
      // apply the color classes directly. The "variant" gives us the
      // base badge styling, and our custom classes override the colors.
      className={STATUS_COLORS[status]}
    >
      {STATUS_LABELS[status]}
    </Badge>
  );
}
