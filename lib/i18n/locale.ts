import "server-only";

import { cache } from "react";

import { getMessages, type Locale, type Messages } from "@/lib/i18n";
import { createClient } from "@/lib/db/server";
import { getCurrentUser } from "@/lib/auth/session";

/**
 * The signed-in person's own language.
 *
 * Per person rather than per business: an owner may work in English while the
 * staff who use the dashboard all day read Bangla.
 *
 * Cached per request — several pages and components ask for it while rendering
 * one screen, and it must not become several round trips.
 *
 * Note that a page cannot read this at module level. A module is evaluated once
 * for the whole server, so anything decided there is the same for everybody;
 * the dictionary has to be fetched inside the component that renders.
 */
export const getDictionary = cache(async function getDictionary(): Promise<Messages> {
  const user = await getCurrentUser();
  if (!user) return getMessages("en");

  const db = await createClient();
  const { data } = await db.from("profiles").select("language").eq("id", user.id).maybeSingle();

  return getMessages(((data?.language as Locale) ?? "en") === "bn" ? "bn" : "en");
});

/** Just the code, for the places that only need to know which one is set. */
export async function getLocale(): Promise<Locale> {
  const user = await getCurrentUser();
  if (!user) return "en";

  const db = await createClient();
  const { data } = await db.from("profiles").select("language").eq("id", user.id).maybeSingle();

  return (data?.language as Locale) === "bn" ? "bn" : "en";
}
