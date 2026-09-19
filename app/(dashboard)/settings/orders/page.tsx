import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { Topbar } from "@/components/dashboard/topbar";
import { ConfirmationRulesForm } from "@/components/settings/confirmation-rules-form";
import { getUserInitials } from "@/lib/dashboard/user";
import { getMessages } from "@/lib/i18n";
import { getConfirmationRules } from "@/lib/orders/confirmation";
import { getMembership } from "@/lib/supabase/queries";

const t = getMessages("en");

export const metadata: Metadata = { title: t.confirmation.title };

export default async function OrderRulesPage() {
  const membership = await getMembership();
  if (!membership) redirect("/onboarding");

  const [initials, rules] = await Promise.all([
    getUserInitials(),
    getConfirmationRules(membership.organizationId),
  ]);

  return (
    <>
      <Topbar
        title={t.confirmation.title}
        subtitle={t.confirmation.subtitle}
        nav={t.dashboard.nav}
        userInitials={initials}
      />

      <main className="flex-1 p-4 sm:p-6">
        <div className="mx-auto flex max-w-3xl flex-col gap-4">
          <ConfirmationRulesForm
            copy={t.confirmation}
            defaults={rules}
            canEdit={membership.role === "owner"}
          />
        </div>
      </main>
    </>
  );
}
