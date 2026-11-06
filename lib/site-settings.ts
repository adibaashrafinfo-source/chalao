import "server-only";

import { cache } from "react";
import { unstable_cache } from "next/cache";

import { hasDatabaseConfig } from "@/lib/db/pool";
import { createAdminClient, createClient } from "@/lib/db/server";
import { getCurrentUser } from "@/lib/auth/session";

export type SocialKey = "facebook" | "instagram" | "youtube" | "tiktok" | "linkedin" | "whatsapp";

export type SiteSettings = Record<SocialKey, string | null>;

export const socialKeys: SocialKey[] = ["facebook", "instagram", "youtube", "tiktok", "linkedin", "whatsapp"];

export const SITE_SETTINGS_TAG = "site-settings";

const empty: SiteSettings = {
  facebook: null,
  instagram: null,
  youtube: null,
  tiktok: null,
  linkedin: null,
  whatsapp: null,
};

/**
 * Public marketing settings for the footer.
 *
 * Read with a client that needs no login rather than the cookie-bound one: no session is needed,
 * and staying away from cookies() keeps the marketing pages statically rendered. The
 * result is cached and refreshed when an admin saves (revalidateTag).
 */
export const getSiteSettings = unstable_cache(
  async function loadSiteSettings(): Promise<SiteSettings> {
    // No database configured (or a build without env): the footer simply shows no icons.
    if (!hasDatabaseConfig()) return empty;

    const db = createAdminClient();

    const { data, error } = await db
      .from("site_settings")
      .select("facebook_url, instagram_url, youtube_url, tiktok_url, linkedin_url, whatsapp_url")
      .eq("id", 1)
      .maybeSingle();

    if (error || !data) return empty;

    return {
      facebook: (data.facebook_url as string | null) ?? null,
      instagram: (data.instagram_url as string | null) ?? null,
      youtube: (data.youtube_url as string | null) ?? null,
      tiktok: (data.tiktok_url as string | null) ?? null,
      linkedin: (data.linkedin_url as string | null) ?? null,
      whatsapp: (data.whatsapp_url as string | null) ?? null,
    };
  },
  ["site-settings"],
  { revalidate: 300, tags: [SITE_SETTINGS_TAG] },
);

/** Cached per request: the layout, the sidebar and admin pages all ask. */
export const isPlatformAdmin = cache(async function isPlatformAdmin(): Promise<boolean> {
  const user = await getCurrentUser();
  if (!user) return false;

  const db = await createClient();
  const { data } = await db
    .from("platform_admins")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();

  return Boolean(data);
});
