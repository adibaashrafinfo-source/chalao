import "server-only";

import { createClient } from "@/lib/supabase/server";

export type ProfitSummary = {
  /** Delivered orders only — an order still in a van has earned nothing. */
  revenue: number;
  cogs: number;
  grossProfit: number;
  courierCharges: number;
  returnCharges: number;
  /** Payouts that did not add up. Negative means the courier paid less. */
  codDifference: number;
  netProfit: number;
  deliveredOrders: number;
  returnedOrders: number;
  margin: number;
};

export type ProductProfit = {
  productName: string;
  variantName: string | null;
  quantity: number;
  revenue: number;
  cost: number;
  profit: number;
};

export type PeriodKey = "this_month" | "last_month" | "last_30";

/** The three windows a seller actually asks about. */
export function periodRange(period: PeriodKey): { from: string; to: string } {
  const now = new Date();
  const iso = (date: Date) => date.toISOString().slice(0, 10);

  if (period === "last_month") {
    const first = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const last = new Date(now.getFullYear(), now.getMonth(), 0);
    return { from: iso(first), to: iso(last) };
  }

  if (period === "last_30") {
    const start = new Date(now);
    start.setDate(start.getDate() - 29);
    return { from: iso(start), to: iso(now) };
  }

  return { from: iso(new Date(now.getFullYear(), now.getMonth(), 1)), to: iso(now) };
}

export async function getProfitSummary(
  organizationId: string,
  from: string,
  to: string,
): Promise<ProfitSummary> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("profit_summary", {
    p_organization_id: organizationId,
    p_from: from,
    p_to: to,
  });

  const row = (data ?? {}) as Record<string, number>;
  return {
    revenue: Number(row.revenue ?? 0),
    cogs: Number(row.cogs ?? 0),
    grossProfit: Number(row.gross_profit ?? 0),
    courierCharges: Number(row.courier_charges ?? 0),
    returnCharges: Number(row.return_charges ?? 0),
    codDifference: Number(row.cod_difference ?? 0),
    netProfit: Number(row.net_profit ?? 0),
    deliveredOrders: Number(row.delivered_orders ?? 0),
    returnedOrders: Number(row.returned_orders ?? 0),
    margin: Number(row.margin ?? 0),
  };
}

export async function getProductProfit(
  organizationId: string,
  from: string,
  to: string,
): Promise<ProductProfit[]> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("product_profit", {
    p_organization_id: organizationId,
    p_from: from,
    p_to: to,
  });

  return ((data ?? []) as Record<string, string | number | null>[]).map((row) => ({
    productName: String(row.product_name ?? ""),
    variantName: (row.variant_name as string | null) ?? null,
    quantity: Number(row.quantity ?? 0),
    revenue: Number(row.revenue ?? 0),
    cost: Number(row.cost ?? 0),
    profit: Number(row.profit ?? 0),
  }));
}
