import "server-only";

import { cache } from "react";
import type { User } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/server";

/**
 * The signed-in user, fetched once per request.
 *
 * supabase.auth.getUser() is a network call to the Auth server, and a single page
 * used to make three or four of them (layout, admin check, avatar initials, page
 * body). cache() collapses them into one.
 */
export const getCurrentUser = cache(async function getCurrentUser(): Promise<User | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});
