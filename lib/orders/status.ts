// Order status presentation. The allowed transitions themselves live in the database
// (transition_order_status), and the order screens arrive in build step 6.

export type OrderStatus =
  | "new"
  | "confirmed"
  | "processing"
  | "ready_to_ship"
  | "shipped"
  | "delivered"
  | "cancelled"
  | "returned"
  | "refunded";

type ChipTone = "success" | "danger" | "warning" | "neutral" | "brand";

const chipTone: Record<OrderStatus, ChipTone> = {
  new: "danger", // needs attention
  confirmed: "success",
  processing: "warning",
  ready_to_ship: "warning",
  shipped: "brand",
  delivered: "success",
  cancelled: "neutral",
  returned: "danger",
  refunded: "neutral",
};

const label: Record<OrderStatus, string> = {
  new: "New",
  confirmed: "Confirmed",
  processing: "Processing",
  ready_to_ship: "Ready to ship",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
  returned: "Returned",
  refunded: "Refunded",
};

// Mirrors order_status_can_move() in the database (Brief §8). The database is the
// authority; this only decides which buttons to show.
const transitions: Record<OrderStatus, OrderStatus[]> = {
  new: ["confirmed", "cancelled"],
  confirmed: ["processing", "cancelled"],
  processing: ["ready_to_ship"],
  // shipped only happens through a successful courier booking (build step 8).
  ready_to_ship: [],
  shipped: ["delivered", "returned"],
  delivered: ["refunded"],
  cancelled: [],
  returned: [],
  refunded: [],
};

export function nextStatuses(status: string): OrderStatus[] {
  return transitions[status as OrderStatus] ?? [];
}

/** Details and items may only be changed before the order is handed to a courier. */
export function isOrderEditable(status: string): boolean {
  return status === "new" || status === "confirmed";
}

/** Items may only change while nothing has been committed to stock yet. */
export function areItemsEditable(status: string): boolean {
  return status === "new";
}

export function orderStatusTone(status: string): ChipTone {
  return chipTone[status as OrderStatus] ?? "neutral";
}

export function orderStatusLabel(status: string): string {
  return label[status as OrderStatus] ?? status;
}

const sourceLabel: Record<string, string> = {
  facebook: "Facebook",
  instagram: "Instagram",
  whatsapp: "WhatsApp",
  website: "Website",
  phone: "Phone",
  manual: "Manual",
  daraz: "Daraz",
  other: "Other",
};

export function orderSourceLabel(source: string): string {
  return sourceLabel[source] ?? source;
}
