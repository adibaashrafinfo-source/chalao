import { redirect } from "next/navigation";

import { QueryProvider } from "@/components/providers/query-provider";
import { Sidebar } from "@/components/dashboard/sidebar";
import { getMessages } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/server";
import { getMembership } from "@/lib/supabase/queries";

// Every dashboard screen depends on the signed-in user, so none of them are
// prerendered at build time.
export const dynamic = "force-dynamic";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const t = getMessages("en");
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Brief §6.1: no organization means onboarding isn't finished.
  const membership = await getMembership();
  if (!membership) redirect("/onboarding");

  return (
    <QueryProvider>
      <div className="flex min-h-dvh bg-app">
        <Sidebar
          nav={t.dashboard.nav}
          support={t.dashboard.support}
          organizationName={membership.organizationName}
          role={membership.role}
        />
        <div className="flex min-w-0 flex-1 flex-col">{children}</div>
      </div>
    </QueryProvider>
  );
}
