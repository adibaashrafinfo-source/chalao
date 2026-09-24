import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Globe } from "lucide-react";

import { Topbar } from "@/components/dashboard/topbar";
import { OrganizationForm } from "@/components/settings/organization-form";
import { getUserInitials } from "@/lib/dashboard/user";
import { getMessages } from "@/lib/i18n";
import { isPlatformAdmin } from "@/lib/site-settings";
import { createClient } from "@/lib/supabase/server";
import { getMembership } from "@/lib/supabase/queries";
import type { BusinessType } from "@/lib/validations/onboarding";

const t = getMessages("en");

export const metadata: Metadata = { title: t.settings.organization.title };

export default async function OrganizationSettingsPage() {
  const membership = await getMembership();
  if (!membership) redirect("/onboarding");

  const supabase = await createClient();
  const initials = await getUserInitials();

  const [{ data: organization }, admin] = await Promise.all([
    supabase
      .from("organizations")
      .select("id, name, business_type, phone, address")
      .eq("id", membership.organizationId)
      .maybeSingle(),
    isPlatformAdmin(),
  ]);

  return (
    <>
      <Topbar
        title={t.settings.organization.title}
        subtitle={t.settings.organization.subtitle}
        nav={t.dashboard.nav}
        userInitials={initials}
      />

      <main className="flex-1 p-4 sm:p-6">
        <div className="mx-auto flex max-w-3xl flex-col gap-4">
          <OrganizationForm
            copy={t.settings.organization}
            businessTypeLabels={t.onboarding.businessTypes}
            canEdit={membership.role === "owner"}
            defaults={{
              name: (organization?.name as string) ?? membership.organizationName,
              businessType: ((organization?.business_type as BusinessType) ?? "other") as BusinessType,
              phone: (organization?.phone as string | null) ?? null,
              address: (organization?.address as string | null) ?? null,
            }}
          />

          {/* Only the people who run Chalao itself see this. */}
          {admin && (
            <Link
              href="/settings/site"
              className="flex items-center gap-3 rounded-xl bg-surface p-5 shadow-xs hover:bg-surface-alt"
            >
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-surface-alt text-brand-dark">
                <Globe className="size-5" aria-hidden="true" />
              </span>
              <span className="flex flex-col">
                <span className="font-display text-sm font-semibold text-brand-dark">
                  {t.settings.site.title}
                </span>
                <span className="text-sm text-text-secondary">{t.settings.site.subtitle}</span>
              </span>
            </Link>
          )}
        </div>
      </main>
    </>
  );
}
