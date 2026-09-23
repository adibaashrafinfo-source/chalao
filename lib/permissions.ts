// What each role may do, in one place.
//
// The database enforces all of this (migration 0019). This table exists so the
// screens can stop offering what would be refused — a button that always fails
// is worse than no button. It is a copy of the rules, not the rules themselves.

export type MemberRole = "owner" | "manager" | "staff";

export type Permission =
  /** Removing a product, a variant or a customer. */
  | "delete_records"
  /** Changing a selling price. */
  | "change_price"
  /** Cancelling an order: stock comes back, the sale is lost. */
  | "cancel_order"
  /** Connecting, disconnecting or removing a courier account. */
  | "manage_couriers"
  /** Connecting, disconnecting or removing a channel. */
  | "manage_channels"
  /** Recording or removing what a courier paid. The cash book. */
  | "manage_cod"
  /** The team, the organization, the order rules, billing. */
  | "manage_settings";

const MANAGER_AND_OWNER: Permission[] = [
  "delete_records",
  "change_price",
  "cancel_order",
  "manage_couriers",
  "manage_channels",
];

const OWNER_ONLY: Permission[] = ["manage_cod", "manage_settings"];

export function can(role: string | null | undefined, permission: Permission): boolean {
  if (role === "owner") return true;
  if (role === "manager") return MANAGER_AND_OWNER.includes(permission);
  if (role === "staff") return false;
  return false;
}

/** True for the permissions only the owner has, used to word refusals. */
export function isOwnerOnly(permission: Permission): boolean {
  return OWNER_ONLY.includes(permission);
}
