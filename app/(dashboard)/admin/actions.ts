"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { isPlatformAdmin } from "@/lib/site-settings";

export type ActionResult = { error?: string };

// The database checks is_platform_admin() inside every function below; this is the
// same check one step earlier, so a non-admin never even reaches the call.
async function requireAdmin(): Promise<ActionResult | null> {
  if (await isPlatformAdmin()) return null;
  return { error: "Platform admin only" };
}

function refresh(organizationId?: string) {
  revalidatePath("/admin");
  revalidatePath("/admin/payments");
  if (organizationId) revalidatePath(`/admin/${organizationId}`);
}

const planSchema = z.object({
  organizationId: z.string().uuid(),
  planCode: z.enum(["free", "starter", "growth", "business"]),
  note: z.string().trim().max(300).optional(),
});

export async function changePlanAction(values: unknown): Promise<ActionResult> {
  const denied = await requireAdmin();
  if (denied) return denied;

  const parsed = planSchema.safeParse(values);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid details" };

  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_set_subscription", {
    p_organization_id: parsed.data.organizationId,
    p_plan_code: parsed.data.planCode,
    p_note: parsed.data.note || null,
  });

  if (error) return { error: error.message };

  refresh(parsed.data.organizationId);
  return {};
}

const statusSchema = z.object({
  organizationId: z.string().uuid(),
  suspend: z.boolean(),
  note: z.string().trim().max(300).optional(),
});

export async function setSuspendedAction(values: unknown): Promise<ActionResult> {
  const denied = await requireAdmin();
  if (denied) return denied;

  const parsed = statusSchema.safeParse(values);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid details" };

  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_set_subscription", {
    p_organization_id: parsed.data.organizationId,
    p_status: parsed.data.suspend ? "suspended" : "active",
    p_note: parsed.data.note || null,
  });

  if (error) return { error: error.message };

  refresh(parsed.data.organizationId);
  return {};
}

const periodSchema = z.object({
  organizationId: z.string().uuid(),
  periodEnd: z.string().trim().optional(),
  clear: z.boolean().default(false),
  note: z.string().trim().max(300).optional(),
});

/** Correct the renewal date by hand, or clear it so the plan never expires. */
export async function setPeriodEndAction(values: unknown): Promise<ActionResult> {
  const denied = await requireAdmin();
  if (denied) return denied;

  const parsed = periodSchema.safeParse(values);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid details" };
  if (!parsed.data.clear && !parsed.data.periodEnd) return { error: "Pick a date" };

  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_set_subscription", {
    p_organization_id: parsed.data.organizationId,
    p_period_end: parsed.data.clear ? null : parsed.data.periodEnd,
    p_clear_period: parsed.data.clear,
    p_note: parsed.data.note || null,
  });

  if (error) return { error: error.message };

  refresh(parsed.data.organizationId);
  return {};
}

const paymentSchema = z.object({
  organizationId: z.string().uuid(),
  planCode: z.enum(["free", "starter", "growth", "business"]),
  months: z.coerce.number().int().min(1).max(12),
  amount: z.coerce.number().min(0).max(9_999_999),
  method: z.enum(["bkash", "nagad", "bank", "cash"]),
  transactionId: z.string().trim().max(100).optional(),
  note: z.string().trim().max(300).optional(),
});

/** Money that arrived outside the app — cash, or a transfer the seller never submitted. */
export async function recordPaymentAction(values: unknown): Promise<ActionResult> {
  const denied = await requireAdmin();
  if (denied) return denied;

  const parsed = paymentSchema.safeParse(values);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid details" };

  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_record_payment", {
    p_organization_id: parsed.data.organizationId,
    p_plan_code: parsed.data.planCode,
    p_months: parsed.data.months,
    p_amount: parsed.data.amount,
    p_method: parsed.data.method,
    p_transaction_id: parsed.data.transactionId || null,
    p_note: parsed.data.note || null,
  });

  if (error) return { error: error.message };

  refresh(parsed.data.organizationId);
  return {};
}

const reviewSchema = z.object({
  submissionId: z.string().uuid(),
  approve: z.boolean(),
  note: z.string().trim().max(300).optional(),
  organizationId: z.string().uuid().optional(),
});

/** Approving extends the subscription; rejecting leaves the seller where they are. */
export async function reviewSubmissionAction(values: unknown): Promise<ActionResult> {
  const denied = await requireAdmin();
  if (denied) return denied;

  const parsed = reviewSchema.safeParse(values);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid details" };

  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_review_submission", {
    p_submission_id: parsed.data.submissionId,
    p_approve: parsed.data.approve,
    p_note: parsed.data.note || null,
  });

  if (error) return { error: error.message };

  refresh(parsed.data.organizationId);
  return {};
}
