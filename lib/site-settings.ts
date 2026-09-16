import "server-only";

import { cache } from "react";

import { createClient } from "@/lib/supabase/server";

export type SocialKey = "facebook" | "instagram" | "youtube" | "tiktok" | "linkedin" | "whatsapp";

export type SiteSettings = Record<SocialKey, string | null>;

export const socialKeys: SocialKey[] = ["facebook", "instagram", "youtube", "tiktok", "linkedin", "whatsapp"];

const empty: SiteSettings = {
  facebook: null,
  instagram: null,
  youtube: null,
  tiktok: null,
  linkedin: null,
  whatsapp: null,
};

/** Public marketing settings. Readable by visitors; only a platform admin can change them. */
export const getSiteSettings = cache(async function getSiteSettings(): Promise<SiteSettings> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("site_settings")
    .select("facebook_url, instagram_url, youtube_url, tiktok_url, linkedin_url, whatsapp_url")
    .eq("id", 1)
    .maybeSingle();

  // Before the migration runs, or with no row yet, the footer simply shows no icons.
  if (error || !data) return empty;

  return {
    facebook: (data.facebook_url as string | null) ?? null,
    instagram: (data.instagram_url as string | null) ?? null,
    youtube: (data.youtube_url as string | null) ?? null,
    tiktok: (data.tiktok_url as string | null) ?? null,
    linkedin: (data.linkedin_url as string | null) ?? null,
    whatsapp: (data.whatsapp_url as string | null) ?? null,
  };
});

export async function isPlatformAdmin(): Promise<boolean> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;

  const { data } = await supabase
    .from("platform_admins")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();

  return Boolean(data);
}
