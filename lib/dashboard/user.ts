import "server-only";

import { createClient } from "@/lib/supabase/server";

/** Initials for the top-bar avatar, from the signed-in user's name or email. */
export async function getUserInitials(): Promise<string> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const source = (user?.user_metadata?.full_name as string | undefined) ?? user?.email ?? "";

  return (
    source
      .split(/[\s@.]+/)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("") || "U"
  );
}
