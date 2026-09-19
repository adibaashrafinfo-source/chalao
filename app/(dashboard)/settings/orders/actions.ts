"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { getMessages } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/server";
import { getMembership } from "@/lib/supabase/queries";

const t = getMessages("en");

export type ActionResult = { error?: string };

// An empty box means "no limit", which is different from zero.
const optionalMoney = z
  .union([z.string(), z.number(), z.null()])
  .transform((value) => {
    if (value === null) return null;
    const text = String(value).trim();
    if (text === "") return null;
    const parsed = Number(text);
    return Number.isFinite(parsed) ? parsed : Number.NaN;
  })
  .refine((value) => value === null || (value >= 0 && value <= 99_999_999), t.confirmation.errors.invalid);

const rulesSchema = z.object({
  autoConfirmEnabled: z.boolean(),
  autoConfirmMaxTotal: optionalMoney,
  autoConfirmNewCustomers: z.boolean(),
  advancePaymentAbove: optionalMoney,
});

export async function saveConfirmationRulesAction(values: unknown): Promise<ActionResult> {
  const parsed = rulesSchema.safeParse(values);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? t.confirmation.errors.invalid };

  const membership = await getMembership();
  if (!membership) redirect("/onboarding");
  // The database enforces this too; saying it here gives a readable message.
  if (membership.role !== "owner") return { error: t.confirmation.errors.notOwner };

  const supabase = await createClient();
  const input = parsed.data;

  const { error } = await supabase.from("order_confirmation_rules").upsert(
    {
      organization_id: membership.organizationId,
      auto_confirm_enabled: input.autoConfirmEnabled,
      auto_confirm_max_total: input.autoConfirmMaxTotal,
      auto_confirm_new_customers: input.autoConfirmNewCustomers,
      advance_payment_above: input.advancePaymentAbove,
    },
    { onConflict: "organization_id" },
  );

  if (error) return { error: error.message };

  revalidatePath("/settings/orders");
  revalidatePath("/orders");
  return {};
}
