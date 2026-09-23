// Shapes for the returns screens. No server imports, so the form can use them too.

export const returnReasons = [
  "refused",
  "unreachable",
  "wrong_address",
  "damaged",
  "changed_mind",
  "other",
] as const;

export type ReturnReason = (typeof returnReasons)[number];

export type ReturnsSummary = {
  /** Returns recorded this calendar month. */
  count: number;
  /** What the courier charged for them. */
  charges: number;
  /** What those orders were worth. */
  orderValue: number;
  /** How many came back unsellable. */
  unsellable: number;
  /** Parcels delivered this month, to read the count against. */
  delivered: number;
};

export type ReturnRow = {
  id: string;
  orderId: string;
  orderNumber: number;
  customerName: string | null;
  total: number;
  reason: ReturnReason;
  returnCharge: number;
  restocked: boolean;
  note: string | null;
  createdAt: string;
};
