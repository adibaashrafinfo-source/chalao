"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { getMessages } from "@/lib/i18n";
import { returnReasons } from "@/lib/returns/types";
import { createClient } from "@/lib/supabase/server";
import { getMembership } from "@/lib/supabase/queries";

const t = getMessages("en");

export type ActionResult = { error?: string };

const returnSchema = z.object({
  orderId: z.string().uuid(),
  reason: z.enum(returnReasons),
  returnCharge: z.coerce.number().min(0).max(99_999_999),
  restocked: z.boolean(),
  note: z.string().trim().max(500).nullable(),
});

/**
 * Receiving a parcel back is day-to-day work, so staff may record it. What they
 * cannot do is cancel an order — that is a decision; this is a fact.
 */
export async function recordReturnAction(values: unknown): Promise<ActionResult> {
  const parsed = returnSchema.safeParse(values);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? t.returns.errors.invalid };

  const membership = await getMembership();
  if (!membership) redirect("/onboarding");

  const supabase = await createClient();
  const input = parsed.data;

  const { error } = await supabase.rpc("record_order_return", {
    p_order_id: input.orderId,
    p_reason: input.reason,
    p_return_charge: input.returnCharge,
    p_restock: input.restocked,
    p_note: input.note,
  });

  if (error) {
    if (error.message.includes("RETURN_ALREADY_RECORDED")) return { error: t.returns.errors.already };
    return { error: error.message };
  }

  revalidatePath("/returns");
  revalidatePath(`/orders/${input.orderId}`);
  revalidatePath("/inventory");
  return {};
}
