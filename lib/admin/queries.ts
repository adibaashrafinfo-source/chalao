import "server-only";

import { createClient } from "@/lib/supabase/server";

// Everything the admin panel reads goes through these SECURITY DEFINER functions,
// which check is_platform_admin() in the database. They return who a seller is and
// how much they use — never the contents of their orders or customers.

export type AdminOrganizationRow = {
  organization_id: string;
  name: string;
  business_type: string;
  created_at: string;
  owner_email: string | null;
  member_count: number;
  plan_code: string;
  plan_name: string;
  monthly_price: number;
  order_limit: number | null;
  status: string;
  state: "active" | "grace" | "expired" | "suspended";
  period_end: string | null;
  orders_this_month: number;
  orders_total: number;
  pending_submissions: number;
};

export type AdminOrganizationDetail = AdminOrganizationRow & {
  product_count: number;
  customer_count: number;
  courier_count: number;
  last_order_at: string | null;
  members: { email: string; role: string }[];
};

export type AdminSubmissionRow = {
  id: string;
  organization_id: string;
  organization_name: string;
  owner_email: string | null;
  plan_code: string;
  months: number;
  amount: number;
  method: string;
  sender_number: string | null;
  transaction_id: string;
  status: "pending" | "approved" | "rejected";
  created_at: string;
  reviewed_at: string | null;
  review_note: string | null;
};

export async function listOrganizations(search?: string): Promise<AdminOrganizationRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_list_organizations", {
    p_search: search?.trim() || null,
  });

  if (error) return [];
  return (data ?? []) as AdminOrganizationRow[];
}

export async function getOrganizationDetail(organizationId: string): Promise<AdminOrganizationDetail | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_organization_detail", {
    p_organization_id: organizationId,
  });

  if (error || !data) return null;
  return data as AdminOrganizationDetail;
}

export async function listSubmissions(status?: string): Promise<AdminSubmissionRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_list_submissions", {
    p_status: status && status !== "all" ? status : null,
  });

  if (error) return [];
  return (data ?? []) as AdminSubmissionRow[];
}

/** Payments recorded for one organization, newest first. */
export async function listOrganizationPayments(organizationId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("subscription_payments")
    .select("id, plan_code, months, amount, method, transaction_id, period_start, period_end, created_at")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(50);

  return data ?? [];
}

export async function listOrganizationEvents(organizationId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("subscription_events")
    .select("id, event_type, detail, note, created_at")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(50);

  return data ?? [];
}
