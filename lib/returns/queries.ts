import "server-only";

import type { ReturnRow, ReturnsSummary, ReturnReason } from "@/lib/returns/types";
import { createClient } from "@/lib/supabase/server";

export async function getReturnsSummary(organizationId: string): Promise<ReturnsSummary> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("returns_summary", { p_organization_id: organizationId });

  const row = (data ?? {}) as Record<string, number>;
  return {
    count: Number(row.count ?? 0),
    charges: Number(row.charges ?? 0),
    orderValue: Number(row.order_value ?? 0),
    unsellable: Number(row.unsellable ?? 0),
    delivered: Number(row.delivered ?? 0),
  };
}

export async function listReturns(organizationId: string): Promise<ReturnRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("order_returns")
    .select("id, order_id, reason, return_charge, restocked, note, created_at, orders(order_number, total, customers(name))")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(200);

  return (data ?? []).map((row) => {
    // PostgREST returns a joined row as an object or a single-element array.
    const order = (Array.isArray(row.orders) ? row.orders[0] : row.orders) as
      | { order_number: number; total: number; customers: { name: string } | { name: string }[] | null }
      | null;
    const customer = order
      ? ((Array.isArray(order.customers) ? order.customers[0] : order.customers) as { name: string } | null)
      : null;

    return {
      id: row.id as string,
      orderId: row.order_id as string,
      orderNumber: order ? Number(order.order_number) : 0,
      customerName: customer?.name ?? null,
      total: order ? Number(order.total) : 0,
      reason: row.reason as ReturnReason,
      returnCharge: Number(row.return_charge),
      restocked: Boolean(row.restocked),
      note: (row.note as string | null) ?? null,
      createdAt: row.created_at as string,
    };
  });
}

/** True when this order already has its return written down. */
export async function hasReturnRecord(orderId: string): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase.from("order_returns").select("id").eq("order_id", orderId).maybeSingle();
  return Boolean(data);
}
