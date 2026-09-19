// Shape of the confirmation decision. No server imports, so client components
// can use it too (same split as lib/risk/types.ts).
//
// The rules themselves live in order_confirmation_decision() in the database,
// which returns codes rather than sentences so the dashboard can say them in the
// seller's own words.

import type { CustomerRisk, RiskLevel } from "@/lib/risk/types";

/** What a person should do about this order, whatever the software decided. */
export type ConfirmationAdvice = "take_advance" | "call_to_confirm" | "large_order";

/** Why the software did not confirm it on its own. */
export type ConfirmationBlocker =
  | "auto_off"
  | "risk_high"
  | "risk_watch"
  | "new_customer"
  | "over_cap"
  | "needs_advance";

export type ConfirmationDecision = {
  action: "auto" | "manual";
  advice: ConfirmationAdvice[];
  blockers: ConfirmationBlocker[];
  riskLevel: RiskLevel;
  risk: CustomerRisk | null;
  total: number;
  status: string;
};

export type ConfirmationRules = {
  autoConfirmEnabled: boolean;
  autoConfirmMaxTotal: number | null;
  autoConfirmNewCustomers: boolean;
  advancePaymentAbove: number | null;
};

export const defaultConfirmationRules: ConfirmationRules = {
  autoConfirmEnabled: false,
  autoConfirmMaxTotal: null,
  autoConfirmNewCustomers: false,
  advancePaymentAbove: null,
};
