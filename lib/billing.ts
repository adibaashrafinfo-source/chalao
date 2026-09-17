// Where sellers send money. Manual for now: they transfer, then submit the
// transaction id, and a platform admin approves it.
//
// Set NEXT_PUBLIC_PAYMENT_NUMBER to change the number without a code change.
export const paymentNumber = process.env.NEXT_PUBLIC_PAYMENT_NUMBER || "01719-686459";

/** "Send Money" on a personal account, not "Payment" — that is what the number accepts. */
export const paymentMethods = ["bkash", "nagad"] as const;
export type PaymentMethod = (typeof paymentMethods)[number];

export const monthOptions = [1, 2, 3, 6, 12] as const;
