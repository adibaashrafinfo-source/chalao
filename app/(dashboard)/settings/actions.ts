"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { getMembership } from "@/lib/supabase/queries";
import { businessTypeValues } from "@/lib/validations/onboarding";

export type ActionResult = { error?: string };

const organizationSchema = z.object({
  name: z.string().trim().min(2, "Business name is required").max(120),
  businessType: z.enum(businessTypeValues),
});

// Empty string clears the link; anything else must be a real https address.
const socialUrl = z
  .string()
  .trim()
  .max(300)
  .transform((value) => (value === "" ? null : value))
  .nullable()
  .refine(
    (value) => value === null || /^https?:\/\/.+/i.test(value),
    "Enter a full web address starting with https://",
  );

const siteSchema = z.object({
  facebook: socialUrl,
  instagram: socialUrl,
  youtube: socialUrl,
  tiktok: socialUrl,
  linkedin: socialUrl,
  whatsapp: socialUrl,
});

export async function updateOrganizationAction(values: unknown): Promise<ActionResult> {
  const parsed = organizationSchema.safeParse(values);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid details" };

  const membership = await getMembership();
  if (!membership) redirect("/onboarding");

  const supabase = await createClient();
  const { error } = await supabase
    .from("organizations")
    .update({ name: parsed.data.name, business_type: parsed.data.businessType })
    .eq("id", membership.organizationId);

  // RLS lets only the owner through, and returns no rows for anyone else.
  if (error) return { error: error.message };

  revalidatePath("/settings/organization");
  revalidatePath("/dashboard");
  return {};
}

export async function updateSiteSettingsAction(values: unknown): Promise<ActionResult> {
  const parsed = siteSchema.safeParse(values);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid details" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("site_settings")
    .update({
      facebook_url: parsed.data.facebook,
      instagram_url: parsed.data.instagram,
      youtube_url: parsed.data.youtube,
      tiktok_url: parsed.data.tiktok,
      linkedin_url: parsed.data.linkedin,
      whatsapp_url: parsed.data.whatsapp,
    })
    .eq("id", 1);

  if (error) return { error: error.message };

  // The footer is rendered by the marketing layout, so refresh those pages too.
  revalidatePath("/settings/site");
  revalidatePath("/", "layout");
  return {};
}
