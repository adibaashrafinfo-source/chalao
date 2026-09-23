"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { getMessages } from "@/lib/i18n";
import { requirePermission } from "@/lib/permissions-server";
import { createClient } from "@/lib/supabase/server";
import { getMembership } from "@/lib/supabase/queries";

const t = getMessages("en");

export type ActionResult = { error?: string };

async function requireOrg() {
  const membership = await getMembership();
  if (!membership) redirect("/onboarding");
  return membership.organizationId;
}

const money = z.coerce.number().min(0).max(99_999_999);

const payoutSchema = z.object({
  courierAccountId: z.string().uuid().nullable(),
  provider: z.string().min(1),
  paidOn: z.string().min(1),
  amountReceived: money,
  method: z.enum(["bank", "bkash", "nagad", "cash", "other"]),
  reference: z.string().trim().max(120).nullable(),
  note: z.string().trim().max(500).nullable(),
  lines: z
    .array(
      z.object({
        shipmentId: z.string().uuid(),
        deliveryCharge: money,
        codFee: money,
        adjustment: z.coerce.number().min(-99_999_999).max(99_999_999),
      }),
    )
    .min(1, t.cod.errors.noParcels),
});

export async function recordPayoutAction(values: unknown): Promise<ActionResult> {
  const parsed = payoutSchema.safeParse(values);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? t.cod.errors.invalid };

  // Recording a payout is saying "this money arrived" — the cash book, so the owner's alone.
  const allowed = await requirePermission("manage_cod");
  if (allowed.error) return { error: allowed.error };

  const supabase = await createClient();
  const input = parsed.data;

  // The payout and its lines are written by one function, so a parcel that turns
  // out to be settled already cannot leave half a payout behind.
  const { error } = await supabase.rpc("record_courier_payout", {
    p_courier_account_id: input.courierAccountId,
    p_provider: input.provider,
    p_paid_on: input.paidOn,
    p_amount_received: input.amountReceived,
    p_method: input.method,
    p_reference: input.reference,
    p_note: input.note,
    p_items: input.lines.map((line) => ({
      shipment_id: line.shipmentId,
      delivery_charge: line.deliveryCharge,
      cod_fee: line.codFee,
      adjustment: line.adjustment,
    })),
  });

  if (error) return { error: error.message };

  revalidatePath("/cod");
  return {};
}

/**
 * Removing a payout puts its parcels back on the unpaid list. That is the point:
 * these are typed in by hand, and a mistyped one has to be undoable.
 */
export async function deletePayoutAction(payoutId: string): Promise<ActionResult> {
  const allowed = await requirePermission("manage_cod");
  if (allowed.error) return { error: allowed.error };
  const organizationId = allowed.organizationId;
  const supabase = await createClient();

  const { error } = await supabase
    .from("courier_payouts")
    .delete()
    .eq("id", payoutId)
    .eq("organization_id", organizationId);

  if (error) return { error: error.message };

  revalidatePath("/cod");
  return {};
}
