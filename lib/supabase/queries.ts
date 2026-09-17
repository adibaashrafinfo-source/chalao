import "server-only";

import { cache } from "react";

import { createClient } from "@/lib/supabase/server";

export type Membership = {
  organizationId: string;
  organizationName: string;
  role: string;
};

/**
 * The signed-in user's organization, or null if they still need onboarding.
 * Cached per request: the layout and the page below it both ask for it.
 */
export const getMembership = cache(async function getMembership(): Promise<Membership | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("organization_members")
    .select("organization_id, role, organizations(name)")
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;

  // PostgREST returns the joined row as an object or a single-element array depending on the relation.
  const joined = data.organizations as { name: string } | { name: string }[] | null;
  const organization = Array.isArray(joined) ? joined[0] : joined;

  return {
    organizationId: data.organization_id as string,
    organizationName: organization?.name ?? "",
    role: data.role as string,
  };
});
