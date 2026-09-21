"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { getMessages } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/server";
import { getMembership } from "@/lib/supabase/queries";

const t = getMessages("en");

export type ActionResult = { error?: string; token?: string };

// Every change to the team is the owner's to make. The database says so too;
// checking here only turns a refusal into a sentence.
async function requireOwner() {
  const membership = await getMembership();
  if (!membership) redirect("/onboarding");
  if (membership.role !== "owner") return null;
  return membership.organizationId;
}

const inviteSchema = z.object({
  email: z.string().trim().toLowerCase().email(t.team.errors.invalidEmail),
  role: z.enum(["manager", "staff"]),
});

export async function createInvitationAction(values: unknown): Promise<ActionResult> {
  const parsed = inviteSchema.safeParse(values);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? t.team.errors.invalidEmail };

  const organizationId = await requireOwner();
  if (!organizationId) return { error: t.team.ownerOnly };

  const supabase = await createClient();

  // Inviting someone already on the team would only produce a link that fails.
  const { data: team } = await supabase.rpc("organization_team", { p_organization_id: organizationId });
  const emails = ((team ?? []) as { email: string }[]).map((member) => member.email.toLowerCase());
  if (emails.includes(parsed.data.email)) return { error: t.team.errors.alreadyMember };

  const { data, error } = await supabase
    .from("organization_invitations")
    .insert({ organization_id: organizationId, email: parsed.data.email, role: parsed.data.role })
    .select("token")
    .single();

  if (error) {
    // The partial unique index: one open invitation per address.
    if (error.code === "23505") return { error: t.team.errors.alreadyInvited };
    return { error: error.message };
  }

  revalidatePath("/settings/team");
  return { token: data.token as string };
}

export async function revokeInvitationAction(invitationId: string): Promise<ActionResult> {
  const organizationId = await requireOwner();
  if (!organizationId) return { error: t.team.ownerOnly };

  const supabase = await createClient();
  const { error } = await supabase
    .from("organization_invitations")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", invitationId)
    .eq("organization_id", organizationId);

  if (error) return { error: error.message };

  revalidatePath("/settings/team");
  return {};
}

export async function changeRoleAction(memberId: string, role: string): Promise<ActionResult> {
  if (role !== "manager" && role !== "staff") return { error: t.team.errors.generic };

  const organizationId = await requireOwner();
  if (!organizationId) return { error: t.team.ownerOnly };

  const supabase = await createClient();
  const { error } = await supabase
    .from("organization_members")
    .update({ role })
    .eq("id", memberId)
    .eq("organization_id", organizationId);

  if (error) return { error: error.message };

  revalidatePath("/settings/team");
  return {};
}

export async function removeMemberAction(memberId: string): Promise<ActionResult> {
  const organizationId = await requireOwner();
  if (!organizationId) return { error: t.team.ownerOnly };

  const supabase = await createClient();
  const { error } = await supabase
    .from("organization_members")
    .delete()
    .eq("id", memberId)
    .eq("organization_id", organizationId);

  if (error) return { error: error.message };

  revalidatePath("/settings/team");
  return {};
}
