/**
 * EmptyState — shown when there are no orders to display.
 *
 * This could be because:
 * - The user hasn't created any orders yet
 * - The current filter/search has no matching results
 */

/**
 * Props are the inputs a component receives from its parent.
 *
 * We define an interface for them so TypeScript can check that the parent
 * is passing the right data. Think of it like a function's parameters.
 */
interface EmptyStateProps {
  /** Whether ANY orders exist (vs. just no matches for current filter) */
  hasOrders: boolean;
}

/**
 * React.FC means "React Function Component" — it tells TypeScript this
 * function is a React component that takes EmptyStateProps as its props.
 */
export function EmptyState({ hasOrders }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <p className="text-lg font-medium text-muted-foreground">
        {hasOrders
          ? "No orders match your filters"
          : "No orders yet"}
      </p>
      <p className="mt-1 text-sm text-muted-foreground">
        {hasOrders
          ? "Try changing the status filter or search query"
          : "Click \"New Order\" to create your first order"}
      </p>
    </div>
  );
}
