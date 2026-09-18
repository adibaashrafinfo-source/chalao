// Shape and presentation of the customer risk score. No server imports here, so
// client components can use it too (same split as lib/couriers/types.ts).
//
// The arithmetic itself lives in the customer_risk() database function
// (migration 0013), so the number on an order screen and the number on a
// customer screen can never drift apart.

export type RiskLevel = "new" | "good" | "watch" | "high";

export type CustomerRisk = {
  level: RiskLevel;
  score: number;
  totalOrders: number;
  delivered: number;
  returned: number;
  cancelled: number;
  settled: number;
  returnRate: number;
  cancelRate: number;
};

export const riskTone: Record<RiskLevel, "success" | "danger" | "warning" | "neutral"> = {
  new: "neutral",
  good: "success",
  watch: "warning",
  high: "danger",
};
