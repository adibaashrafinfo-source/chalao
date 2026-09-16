import "server-only";

import { cache } from "react";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import type { Database } from "@/types/database";
import { requireSupabaseEnv } from "@/lib/env";

// Use in Server Components, Server Actions and Route Handlers. Runs as the signed-in
// user, so RLS applies. Still scope every query by organization_id explicitly.
//
// cache() keeps ONE client per request. Two clients in the same request can both try to
// refresh an expiring token; the second one then sends an already-rotated refresh token,
// Supabase rejects it, and the user is silently signed out mid-action.
export const createClient = cache(async function createClient() {
  const { url, anonKey } = requireSupabaseEnv();
  const cookieStore = await cookies();

  return createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Called from a Server Component — middleware refreshes the session instead.
        }
      },
    },
  });
});
