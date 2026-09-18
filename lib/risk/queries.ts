import "server-only";

import type { CustomerRisk, RiskLevel } from "@/lib/risk/types";
import { createClient } from "@/lib/supabase/server";

type RiskRow = {
  level: RiskLevel;
  score: number;
  total_orders: number;
  delivered: number;
  returned: number;
  cancelled: number;
  settled: number;
  return_rate: number;
  cancel_rate: number;
};

export async function getCustomerRisk(customerId: string): Promise<CustomerRisk | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("customer_risk", { p_customer_id: customerId });

  if (error || !data) return null;

  const row = data as RiskRow;
  return {
    level: row.level,
    score: row.score,
    totalOrders: row.total_orders,
    delivered: row.delivered,
    returned: row.returned,
    cancelled: row.cancelled,
    settled: row.settled,
    returnRate: row.return_rate,
    cancelRate: row.cancel_rate,
  };
}
