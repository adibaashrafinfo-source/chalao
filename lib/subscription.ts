import "server-only";

import { createClient } from "@/lib/supabase/server";

export type GateReason = "SUBSCRIPTION_SUSPENDED" | "SUBSCRIPTION_EXPIRED" | "ORDER_LIMIT_REACHED";

export type OrderGate = {
  state: "active" | "grace" | "expired" | "suspended";
  order_limit: number | null;
  orders_this_month: number;
  allowed: boolean;
  reason: GateReason | null;
};

const openGate: OrderGate = {
  state: "active",
  order_limit: null,
  orders_this_month: 0,
  allowed: true,
  reason: null,
};

/**
 * Can this business create another order right now, and if not, why not?
 * The database enforces the same rules on insert; this is for explaining them
 * before the seller fills in a form.
 */
export async function getOrderGate(organizationId: string): Promise<OrderGate> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("subscription_order_gate", {
    p_organization_id: organizationId,
  });

  // Before the migration runs, nothing is blocked.
  if (error || !data) return openGate;
  return data as OrderGate;
}

/** Turns the database's error codes into something a seller can act on. */
export function gateReasonFromError(message: string | undefined): GateReason | null {
  if (!message) return null;
  if (message.includes("SUBSCRIPTION_SUSPENDED")) return "SUBSCRIPTION_SUSPENDED";
  if (message.includes("SUBSCRIPTION_EXPIRED")) return "SUBSCRIPTION_EXPIRED";
  if (message.includes("ORDER_LIMIT_REACHED")) return "ORDER_LIMIT_REACHED";
  return null;
}
