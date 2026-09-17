"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { getMessages } from "@/lib/i18n";
import { normalizeBdPhone } from "@/lib/phone";
import { createClient } from "@/lib/supabase/server";
import { getMembership } from "@/lib/supabase/queries";

const t = getMessages("en");

export type ActionResult = { error?: string };

const submissionSchema = z.object({
  planCode: z.enum(["free", "starter", "growth", "business"]),
  months: z.coerce.number().int().min(1).max(12),
  amount: z.coerce.number().min(1, "Enter the amount you sent").max(9_999_999),
  method: z.enum(["bkash", "nagad"]),
  senderNumber: z.string().trim().min(1, "Enter the number you sent from").transform(normalizeBdPhone),
  transactionId: z.string().trim().min(4, "Enter the transaction ID from your bKash or Nagad message").max(100),
});

/**
 * A seller claims a payment. This only records the claim — the plan does not change
 * until a platform admin checks the transaction and approves it.
 */
export async function submitPaymentAction(values: unknown): Promise<ActionResult> {
  const parsed = submissionSchema.safeParse(values);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? t.billing.errors.invalid };

  const membership = await getMembership();
  if (!membership) redirect("/onboarding");

  const supabase = await createClient();
  const { error } = await supabase.rpc("submit_payment", {
    p_plan_code: parsed.data.planCode,
    p_months: parsed.data.months,
    p_amount: parsed.data.amount,
    p_method: parsed.data.method,
    p_sender_number: parsed.data.senderNumber,
    p_transaction_id: parsed.data.transactionId,
  });

  // 23505 = the unique index that stops one transaction id being claimed twice.
  if (error) {
    return { error: error.code === "23505" ? t.billing.errors.duplicate : error.message };
  }

  revalidatePath("/settings/billing");
  revalidatePath("/admin/payments");
  return {};
}
