import "server-only";

import { createClient } from "@/lib/supabase/server";

export type MemberRole = "owner" | "manager" | "staff";

export type TeamMember = {
  memberId: string;
  userId: string;
  role: MemberRole;
  fullName: string | null;
  email: string;
  joinedAt: string;
};

export type Invitation = {
  id: string;
  email: string;
  role: MemberRole;
  token: string;
  expiresAt: string;
};

export async function getTeam(organizationId: string): Promise<TeamMember[]> {
  const supabase = await createClient();
  // Emails live in auth.users, so they come through a function that hands out
  // exactly the fields this screen needs and nothing else.
  const { data } = await supabase.rpc("organization_team", { p_organization_id: organizationId });

  return ((data ?? []) as Record<string, string | null>[]).map((row) => ({
    memberId: row.member_id as string,
    userId: row.user_id as string,
    role: row.role as MemberRole,
    fullName: row.full_name ?? null,
    email: row.email as string,
    joinedAt: row.joined_at as string,
  }));
}

/** Open invitations only — the owner has nothing to do about used or cancelled ones. */
export async function listOpenInvitations(organizationId: string): Promise<Invitation[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("organization_invitations")
    .select("id, email, role, token, expires_at")
    .eq("organization_id", organizationId)
    .is("accepted_at", null)
    .is("revoked_at", null)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false });

  return (data ?? []).map((row) => ({
    id: row.id as string,
    email: row.email as string,
    role: row.role as MemberRole,
    token: row.token as string,
    expiresAt: row.expires_at as string,
  }));
}

/** The plan's user limit, or null when it has none. */
export async function getUserLimit(organizationId: string): Promise<number | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("organization_subscriptions")
    .select("subscription_plans(user_limit)")
    .eq("organization_id", organizationId)
    .maybeSingle();

  const joined = data?.subscription_plans as
    | { user_limit: number | null }
    | { user_limit: number | null }[]
    | null
    | undefined;
  const plan = Array.isArray(joined) ? joined[0] : joined;
  return plan?.user_limit ?? null;
}
