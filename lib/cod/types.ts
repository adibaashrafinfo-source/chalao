// Shapes for the cash-on-delivery screens. No server imports, so the forms can
// use them too (same split as lib/risk/types.ts).

export type CodSummary = {
  /** Parcels delivered whose money has not been accounted for yet. */
  outstandingCount: number;
  outstandingAmount: number;
  /** What the recorded payouts should have added up to. */
  expectedTotal: number;
  /** What actually arrived. */
  receivedTotal: number;
  /** received − expected. Negative means the courier is short. */
  difference: number;
};

export type UnsettledShipment = {
  shipmentId: string;
  orderId: string;
  orderNumber: number;
  provider: string;
  courierAccountId: string | null;
  consignmentId: string | null;
  codAmount: number;
  recipientName: string;
  district: string | null;
  deliveredAt: string | null;
};

export type PayoutItem = {
  id: string;
  orderNumber: number | null;
  consignmentId: string | null;
  recipientName: string | null;
  codAmount: number;
  deliveryCharge: number;
  codFee: number;
  adjustment: number;
  netAmount: number;
};

export type Payout = {
  id: string;
  provider: string;
  courierLabel: string | null;
  reference: string | null;
  paidOn: string;
  amountReceived: number;
  method: string;
  note: string | null;
  parcelCount: number;
  /** Sum of the lines: what this payout should have been. */
  expected: number;
  /** amountReceived − expected. */
  difference: number;
  items: PayoutItem[];
};

/** What the form sends for one parcel in a payout. */
export type PayoutLineInput = {
  shipmentId: string;
  deliveryCharge: number;
  codFee: number;
  adjustment: number;
};
