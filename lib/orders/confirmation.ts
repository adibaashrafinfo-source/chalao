import "server-only";

import {
  defaultConfirmationRules,
  type ConfirmationAdvice,
  type ConfirmationBlocker,
  type ConfirmationDecision,
  type ConfirmationRules,
} from "@/lib/orders/confirmation-types";
import type { CustomerRisk, RiskLevel } from "@/lib/risk/types";
import { createClient } from "@/lib/supabase/server";

type DecisionRow = {
  action: "auto" | "manual";
  advice: ConfirmationAdvice[];
  blockers: ConfirmationBlocker[];
  risk_level: RiskLevel;
  risk: {
    level: RiskLevel;
    score: number;
    total_orders: number;
    delivered: number;
    returned: number;
    cancelled: number;
    settled: number;
    return_rate: number;
    cancel_rate: number;
  } | null;
  total: number;
  status: string;
};

export async function getConfirmationDecision(orderId: string): Promise<ConfirmationDecision | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("order_confirmation_decision", { p_order_id: orderId });

  if (error || !data) return null;

  const row = data as DecisionRow;
  const risk: CustomerRisk | null = row.risk
    ? {
        level: row.risk.level,
        score: row.risk.score,
        totalOrders: row.risk.total_orders,
        delivered: row.risk.delivered,
        returned: row.risk.returned,
        cancelled: row.risk.cancelled,
        settled: row.risk.settled,
        returnRate: row.risk.return_rate,
        cancelRate: row.risk.cancel_rate,
      }
    : null;

  return {
    action: row.action,
    advice: row.advice ?? [],
    blockers: row.blockers ?? [],
    riskLevel: row.risk_level,
    risk,
    total: Number(row.total),
    status: row.status,
  };
}

export async function getConfirmationRules(organizationId: string): Promise<ConfirmationRules> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("order_confirmation_rules")
    .select("auto_confirm_enabled, auto_confirm_max_total, auto_confirm_new_customers, advance_payment_above")
    .eq("organization_id", organizationId)
    .maybeSingle();

  // No row yet means nobody has opened the settings screen. The defaults are the
  // same ones the database falls back to, so the screen and the behaviour agree.
  if (!data) return defaultConfirmationRules;

  return {
    autoConfirmEnabled: Boolean(data.auto_confirm_enabled),
    autoConfirmMaxTotal: data.auto_confirm_max_total === null ? null : Number(data.auto_confirm_max_total),
    autoConfirmNewCustomers: Boolean(data.auto_confirm_new_customers),
    advancePaymentAbove: data.advance_payment_above === null ? null : Number(data.advance_payment_above),
  };
}
