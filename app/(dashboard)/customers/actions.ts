"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getMessages } from "@/lib/i18n";
import { normalizeBdPhone } from "@/lib/phone";
import { requirePermission } from "@/lib/permissions-server";
import { createClient } from "@/lib/supabase/server";
import { getMembership } from "@/lib/supabase/queries";
import { customerSchema } from "@/lib/validations/customer";

const t = getMessages("en");

export type ActionResult = { error?: string };

async function requireOrg() {
  const membership = await getMembership();
  if (!membership) redirect("/onboarding");
  return membership.organizationId;
}

function toRow(values: ReturnType<typeof customerSchema.parse>) {
  return {
    name: values.name,
    phone: values.phone,
    alt_phone: values.altPhone ? normalizeBdPhone(values.altPhone) : null,
    email: values.email,
    address: values.address,
    district: values.district,
    notes: values.notes,
  };
}

export async function createCustomerAction(values: unknown): Promise<ActionResult> {
  const parsed = customerSchema.safeParse(values);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid details" };

  const organizationId = await requireOrg();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("customers")
    .insert({ organization_id: organizationId, ...toRow(parsed.data) })
    .select("id")
    .single();

  // 23505 = the (organization_id, phone) unique index.
  if (error) return { error: error.code === "23505" ? t.customers.errors.duplicatePhone : error.message };

  revalidatePath("/customers");
  redirect(`/customers/${data.id}`);
}

export async function updateCustomerAction(customerId: string, values: unknown): Promise<ActionResult> {
  const parsed = customerSchema.safeParse(values);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid details" };

  const organizationId = await requireOrg();
  const supabase = await createClient();

  const { error } = await supabase
    .from("customers")
    .update(toRow(parsed.data))
    .eq("id", customerId)
    .eq("organization_id", organizationId);

  if (error) return { error: error.code === "23505" ? t.customers.errors.duplicatePhone : error.message };

  revalidatePath("/customers");
  revalidatePath(`/customers/${customerId}`);
  return {};
}

export async function deleteCustomerAction(customerId: string): Promise<ActionResult> {
  const allowed = await requirePermission("delete_records");
  if (allowed.error) return { error: allowed.error };
  const organizationId = allowed.organizationId;
  const supabase = await createClient();

  const { error } = await supabase
    .from("customers")
    .delete()
    .eq("id", customerId)
    .eq("organization_id", organizationId);

  // 23503 = orders still reference this customer.
  if (error) return { error: error.code === "23503" ? t.customers.errors.hasOrders : error.message };

  revalidatePath("/customers");
  redirect("/customers");
}

export type CustomerMatch = {
  id: string;
  name: string;
  phone: string;
  address: string | null;
  district: string | null;
};

/**
 * Phone-first lookup. Used by the customer search box, and by the order form in the
 * next build step ("find by phone, or create a new customer inline").
 */
export async function findCustomersByPhoneAction(query: string): Promise<CustomerMatch[]> {
  const term = query.trim();
  if (term.length < 3) return [];

  const organizationId = await requireOrg();
  const supabase = await createClient();

  const safe = term.replace(/[%,]/g, "");
  // A term with no digits normalises to an empty phone, and "%%" would match everyone.
  const phoneTerm = normalizeBdPhone(safe).replace(/[%,]/g, "");
  const clauses = [`name.ilike.%${safe}%`];
  if (phoneTerm) clauses.unshift(`phone.ilike.%${phoneTerm}%`);

  const { data } = await supabase
    .from("customers")
    .select("id, name, phone, address, district")
    .eq("organization_id", organizationId)
    .or(clauses.join(","))
    .order("created_at", { ascending: false })
    .limit(8);

  return (data ?? []) as CustomerMatch[];
}
