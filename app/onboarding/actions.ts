"use server";

import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth/session";
import { createClient } from "@/lib/db/server";
import { onboardingSchema } from "@/lib/validations/onboarding";

export async function createOrganizationAction(values: unknown): Promise<{ error?: string }> {
  const parsed = onboardingSchema.safeParse(values);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid details" };

  const db = await createClient();
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  // Creates organization + owner membership + default store in one transaction.
  const { error } = await db.rpc("create_organization_with_owner", {
    p_name: parsed.data.organizationName,
    p_business_type: parsed.data.businessType,
  });

  if (error) return { error: error.message };

  redirect("/dashboard");
}
