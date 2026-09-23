import "server-only";

import { redirect } from "next/navigation";

import { getMessages } from "@/lib/i18n";
import { can, isOwnerOnly, type Permission } from "@/lib/permissions";
import { getMembership } from "@/lib/supabase/queries";

const t = getMessages("en");

/**
 * The organization id when this role may do it, or a sentence when it may not.
 *
 * The database refuses these too. Asking here first turns a raw policy failure
 * into something a person can read, and keeps the refusal in the action rather
 * than leaving the screen to guess.
 */
export async function requirePermission(
  permission: Permission,
): Promise<{ organizationId: string; error?: undefined } | { organizationId?: undefined; error: string }> {
  const membership = await getMembership();
  if (!membership) redirect("/onboarding");

  if (!can(membership.role, permission)) {
    return { error: isOwnerOnly(permission) ? t.roles.ownerOnly : t.roles.managerOnly };
  }

  return { organizationId: membership.organizationId };
}
