import { redirect } from "next/navigation";

import { QueryProvider } from "@/components/providers/query-provider";
import { Sidebar } from "@/components/dashboard/sidebar";
import { getMessages } from "@/lib/i18n";
import { isPlatformAdmin } from "@/lib/site-settings";
import { getMembership } from "@/lib/supabase/queries";
import { getCurrentUser } from "@/lib/supabase/user";

// Every dashboard screen depends on the signed-in user, so none of them are
// prerendered at build time.
export const dynamic = "force-dynamic";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const t = getMessages("en");

  // One round trip each, in parallel. Doing these one after another was most of
  // the delay on every navigation.
  const [user, membership, admin] = await Promise.all([
    getCurrentUser(),
    getMembership(),
    isPlatformAdmin(),
  ]);

  if (!user) redirect("/login");
  // Brief §6.1: no organization means onboarding isn't finished.
  if (!membership) redirect("/onboarding");

  return (
    <QueryProvider>
      <div className="flex min-h-dvh bg-app">
        <Sidebar
          nav={t.dashboard.nav}
          support={t.dashboard.support}
          organizationName={membership.organizationName}
          role={membership.role}
          isPlatformAdmin={admin}
        />
        <div className="flex min-w-0 flex-1 flex-col">{children}</div>
      </div>
    </QueryProvider>
  );
}
