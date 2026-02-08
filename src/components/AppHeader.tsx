/**
 * AppHeader — the top bar of the app.
 *
 * Shows the app title and a "New Order" button.
 */

import { Button } from "@/components/ui/button";

interface AppHeaderProps {
  /** Called when the user clicks the "New Order" button */
  onNewOrder: () => void;
}

export function AppHeader({ onNewOrder }: AppHeaderProps) {
  return (
    <header className="flex items-center justify-between border-b px-4 py-4 sm:px-6">
      <div>
        <h1 className="text-xl font-bold sm:text-2xl">Order Tracker</h1>
        <p className="text-sm text-muted-foreground">
          Track your printing orders
        </p>
      </div>
      <Button onClick={onNewOrder}>+ New Order</Button>
    </header>
  );
}
