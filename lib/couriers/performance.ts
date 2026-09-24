import "server-only";

import type { CourierStats } from "@/components/couriers/courier-performance";
import { createClient } from "@/lib/supabase/server";

/** The last 90 days: long enough for returns to have come back. */
export async function getCourierPerformance(organizationId: string): Promise<CourierStats[]> {
  const supabase = await createClient();

  const to = new Date();
  const from = new Date(to);
  from.setDate(from.getDate() - 89);

  const { data } = await supabase.rpc("courier_performance", {
    p_organization_id: organizationId,
    p_from: from.toISOString().slice(0, 10),
    p_to: to.toISOString().slice(0, 10),
  });

  return ((data ?? []) as Record<string, string | number | null>[]).map((row) => ({
    label: String(row.label ?? ""),
    provider: String(row.provider ?? ""),
    sent: Number(row.sent ?? 0),
    delivered: Number(row.delivered ?? 0),
    returned: Number(row.returned ?? 0),
    inFlight: Number(row.in_flight ?? 0),
    returnRate: Number(row.return_rate ?? 0),
    avgDays: row.avg_days === null ? null : Number(row.avg_days),
    codCollected: Number(row.cod_collected ?? 0),
    charges: Number(row.charges ?? 0),
  }));
}
