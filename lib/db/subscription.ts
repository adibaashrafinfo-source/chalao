import "server-only";

import type { Db } from "@/lib/db/db";

export const GRACE_DAYS = 3;

export type SubscriptionState = "active" | "grace" | "expired" | "suspended";

function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export const todayUtc = () => new Date().toISOString().slice(0, 10);

/** 'active' | 'grace' | 'expired' | 'suspended', worked out from the stored row. */
export async function subscriptionState(db: Db, organizationId: string): Promise<SubscriptionState> {
  const row = await db.one<{ status: string; current_period_end: string | null; monthly_price: number | null }>(
    `SELECT s.status, s.current_period_end, p.monthly_price
       FROM organization_subscriptions s
       LEFT JOIN subscription_plans p ON p.code = s.plan_code
      WHERE s.organization_id = ?`,
    [organizationId],
  );
  if (!row) return "expired";
  return stateOf(row);
}

export function stateOf(row: {
  status: string;
  current_period_end: string | null;
  monthly_price: number | null;
}): SubscriptionState {
  if (row.status === "suspended") return "suspended";
  // A free plan carries no period: it stays active whatever dates are left over.
  if (Number(row.monthly_price ?? 0) === 0) return "active";
  if (!row.current_period_end) return "active";

  const end = String(row.current_period_end).slice(0, 10);
  const today = todayUtc();
  if (today <= end) return "active";
  if (today <= addDays(end, GRACE_DAYS)) return "grace";
  return "expired";
}
