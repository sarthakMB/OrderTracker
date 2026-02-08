/**
 * AppHeader — the top bar of the app.
 *
 * Shows the app logo and a "New Order" button.
 */

import { Button } from "@/components/ui/button";

interface AppHeaderProps {
  /** Called when the user clicks the "New Order" button */
  onNewOrder: () => void;
}

export function AppHeader({ onNewOrder }: AppHeaderProps) {
  return (
    <header className="flex items-center justify-between border-b px-4 py-4 sm:px-6">
      <img
        src="/logo.jpg"
        alt="OrderTracker"
        className="h-9 w-auto object-contain sm:h-10"
      />
      <Button onClick={onNewOrder}>+ New Order</Button>
    </header>
  );
}
