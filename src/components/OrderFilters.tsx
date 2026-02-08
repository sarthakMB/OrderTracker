/**
 * OrderFilters — status tabs + search input.
 *
 * Lets the user filter orders by status (tabs) and search by name (input).
 */

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { ORDER_STATUS_LIST, STATUS_LABELS } from "@/lib/constants";
import type { OrderStatus } from "@/types/order";

interface OrderFiltersProps {
  /** Currently selected status tab (null = "All") */
  activeStatus: OrderStatus | null;
  /** Current search query */
  searchQuery: string;
  /** How many orders are in each status (for the badge counts) */
  statusCounts: Record<OrderStatus, number>;
  /** Total number of orders (for the "All" tab badge) */
  totalOrders: number;
  /** Called when the user clicks a status tab */
  onStatusChange: (status: OrderStatus | null) => void;
  /** Called when the user types in the search box */
  onSearchChange: (query: string) => void;
}

export function OrderFilters({
  activeStatus,
  searchQuery,
  statusCounts,
  totalOrders,
  onStatusChange,
  onSearchChange,
}: OrderFiltersProps) {
  return (
    <div className="space-y-4 px-4 pt-4 sm:px-6">
      {/* Status tabs */}
      <Tabs
        // The "value" prop makes this a "controlled component" — React
        // controls which tab is selected, not the browser.
        value={activeStatus ?? "all"}
        onValueChange={(value) => {
          // Convert the tab value back to our status type
          onStatusChange(value === "all" ? null : (value as OrderStatus));
        }}
      >
        <TabsList className="h-auto flex-wrap">
          <TabsTrigger value="all">
            All ({totalOrders})
          </TabsTrigger>
          {ORDER_STATUS_LIST.map((status) => (
            <TabsTrigger key={status} value={status}>
              {STATUS_LABELS[status]} ({statusCounts[status]})
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {/* Search input */}
      <Input
        placeholder="Search by customer, vendor, or description..."
        value={searchQuery}
        onChange={(e) => onSearchChange(e.target.value)}
        className="max-w-sm"
      />
    </div>
  );
}
