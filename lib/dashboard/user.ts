import "server-only";

import { getCurrentUser } from "@/lib/supabase/user";

/** Initials for the top-bar avatar, from the signed-in user's name or email. */
export async function getUserInitials(): Promise<string> {
  const user = await getCurrentUser();
  const source = (user?.user_metadata?.full_name as string | undefined) ?? user?.email ?? "";

  return (
    source
      .split(/[\s@.]+/)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("") || "U"
  );
}
