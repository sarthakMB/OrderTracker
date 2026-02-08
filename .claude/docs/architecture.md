# Architecture Reference

Detailed reference for every source file, API surface, and common tasks.
For the high-level overview see `CLAUDE.md` in the project root.

---

## File-by-File Descriptions

### `src/types/order.ts`
Defines the core data model. All other files import types from here.

**Exports:**
- `OrderStatus` — union type: `"new" | "in_progress" | "at_vendor" | "ready" | "delivered" | "delayed" | "cancelled"`
- `Order` — full order object (id, customerName, customerContact, orderDescription, vendorName, status, notes, createdAt, updatedAt)
- `OrderFormData` — `Omit<Order, "id" | "createdAt" | "updatedAt">` (what the form collects)

### `src/services/orderService.ts`
The **only** file that reads/writes localStorage. Swap this file to migrate to Supabase.

**Public API:**
```ts
getAllOrders(): Order[]
getOrderById(id: string): Order | undefined
createOrder(formData: OrderFormData): Order
updateOrder(id: string, updates: Partial<OrderFormData>): Order | undefined
deleteOrder(id: string): boolean
```

**Internal helpers (not exported):**
- `loadOrders()` / `saveOrders()` — read/write the `"order-tracker-orders"` key
- `generateId()` — calls `crypto.randomUUID()`
- `createOrder` prepends new orders (newest first) and stamps `createdAt`/`updatedAt`
- `updateOrder` merges partial updates and stamps `updatedAt`

### `src/hooks/useOrders.ts`
Single custom hook that owns all app state. Called once in `App.tsx`.

**State:**
```ts
orders: Order[]                          // all orders from storage
activeStatus: OrderStatus | null         // selected filter tab (null = "All")
searchQuery: string                      // search input value
```

**Derived (useMemo):**
```ts
filteredOrders: Order[]                  // filtered → searched → sorted
statusCounts: Record<OrderStatus, number>// badge counts per status
```

**Actions (useCallback):**
```ts
addOrder(formData: OrderFormData): void
editOrder(id: string, updates: Partial<OrderFormData>): void
removeOrder(id: string): void
setActiveStatus(status: OrderStatus | null): void
setSearchQuery(query: string): void
```

**Export:** `UseOrdersReturn` interface (the hook's return type)

### `src/utils/orderUtils.ts`
Pure functions — no side effects, no React. Business logic lives here.

```ts
filterOrdersByStatus(orders: Order[], status: OrderStatus | null): Order[]
searchOrders(orders: Order[], query: string): Order[]
sortOrdersByDate(orders: Order[]): Order[]
getOrderCountsByStatus(orders: Order[]): Record<OrderStatus, number>
```

### `src/lib/constants.ts`
App-wide constants — status metadata lives here.

```ts
STORAGE_KEY: "order-tracker-orders"
ORDER_STATUS_LIST: OrderStatus[]          // display order
STATUS_LABELS: Record<OrderStatus, string>// e.g. "in_progress" → "In Progress"
STATUS_COLORS: Record<OrderStatus, string>// Tailwind classes per status
```

### `src/lib/utils.ts`
shadcn utility. Exports `cn()` for merging Tailwind classes.

### `src/App.tsx`
Root component. Calls `useOrders()`, manages dialog open/close state, passes everything down as props.

### `src/main.tsx`
Entry point. Renders `<App />` into the DOM. Also renders the `<Toaster />` from sonner.

### `src/index.css`
Global Tailwind directives (`@tailwind base/components/utilities`).

---

## Components

### `AppHeader`
Top bar with app title and "+ New Order" button.

| Prop | Type | Description |
|------|------|-------------|
| `onNewOrder` | `() => void` | Opens the create-order dialog |

### `OrderFilters`
Status tab bar + search input.

| Prop | Type | Description |
|------|------|-------------|
| `activeStatus` | `OrderStatus \| null` | Currently selected tab |
| `searchQuery` | `string` | Current search text |
| `statusCounts` | `Record<OrderStatus, number>` | Badge counts |
| `totalOrders` | `number` | Total order count (for "All" tab) |
| `onStatusChange` | `(status: OrderStatus \| null) => void` | Tab clicked |
| `onSearchChange` | `(query: string) => void` | Search input changed |

### `OrderTable`
Renders the table of orders, or `EmptyState` when empty.

| Prop | Type | Description |
|------|------|-------------|
| `orders` | `Order[]` | Filtered/sorted orders to display |
| `hasAnyOrders` | `boolean` | Whether any orders exist at all |
| `onEdit` | `(order: Order) => void` | Edit button clicked |
| `onDelete` | `(id: string) => void` | Delete button clicked |

### `OrderRow`
A single table row for one order.

| Prop | Type | Description |
|------|------|-------------|
| `order` | `Order` | The order to render |
| `onEdit` | `(order: Order) => void` | Edit clicked |
| `onDelete` | `(id: string) => void` | Delete clicked |

### `OrderStatusBadge`
Colored badge showing order status.

| Prop | Type | Description |
|------|------|-------------|
| `status` | `OrderStatus` | Which status to show |

### `OrderDialog`
Modal dialog for creating or editing an order. Contains `OrderForm`.

| Prop | Type | Description |
|------|------|-------------|
| `isOpen` | `boolean` | Controls visibility |
| `onClose` | `() => void` | Close the dialog |
| `onSave` | `(formData: OrderFormData) => void` | Save clicked |
| `orderToEdit` | `Order \| undefined` | If set, dialog is in edit mode |

### `OrderForm`
The form fields inside the dialog. Controlled component.

| Prop | Type | Description |
|------|------|-------------|
| `formData` | `OrderFormData` | Current field values |
| `onChange` | `(updates: Partial<OrderFormData>) => void` | A field changed |

### `EmptyState`
Message shown when no orders match.

| Prop | Type | Description |
|------|------|-------------|
| `hasOrders` | `boolean` | `true` = "no matches", `false` = "create your first order" |

---

## How-To Recipes

### Add a new order status
1. **`src/types/order.ts`** — add the value to the `OrderStatus` union
2. **`src/lib/constants.ts`** — add entries to `ORDER_STATUS_LIST`, `STATUS_LABELS`, and `STATUS_COLORS`
3. That's it — the status tab, badge, and form dropdown all read from constants

### Add a new field to orders
1. **`src/types/order.ts`** — add the field to the `Order` interface (and `OrderFormData` if it's user-editable)
2. **`src/services/orderService.ts`** — no changes needed (it stores the whole object)
3. **`src/components/OrderForm.tsx`** — add a form input for the new field
4. **`src/components/OrderRow.tsx`** — add a table cell to display the field
5. **`src/components/OrderTable.tsx`** — add a column header

### Add a new component
1. Create `src/components/YourComponent.tsx`
2. Define a props interface at the top of the file
3. Import and render it in `App.tsx` (or in the parent component)
4. Pass data down as props, actions as callbacks

### Migrate from localStorage to Supabase
1. Replace the contents of `src/services/orderService.ts`
2. Keep the same function signatures — the rest of the app imports these functions
3. Make functions `async` and update `useOrders.ts` to handle promises
