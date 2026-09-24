import type { Metadata } from "next";
import { Truck } from "lucide-react";

import { ConnectCourier } from "@/components/couriers/connect-courier";
import { CourierCard, type CourierAccountRow } from "@/components/couriers/courier-card";
import { CourierPerformance } from "@/components/couriers/courier-performance";
import { Topbar } from "@/components/dashboard/topbar";
import { getUserInitials } from "@/lib/dashboard/user";
import { getCourierPerformance } from "@/lib/couriers/performance";
import { listCourierAdapters } from "@/lib/couriers/registry";
import { getMessages } from "@/lib/i18n";
import { can } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import { getMembership } from "@/lib/supabase/queries";

const t = getMessages("en");

export const metadata: Metadata = { title: t.couriers.title };

export default async function CouriersPage() {
  const membership = await getMembership();
  const supabase = await createClient();
  const initials = await getUserInitials();

  const performance = await getCourierPerformance(membership?.organizationId ?? "");

  const { data, error } = await supabase
    .from("courier_accounts")
    .select("id, provider, label, is_active, last_tested_at, webhook_token")
    .eq("organization_id", membership?.organizationId ?? "")
    .order("created_at", { ascending: true });

  const accounts = (data ?? []) as CourierAccountRow[];

  const providers = listCourierAdapters().map((adapter) => ({
    provider: adapter.provider,
    label: adapter.label,
    credentialFields: adapter.credentialFields,
  }));
  const providerLabels = new Map<string, string>(providers.map((entry) => [entry.provider, entry.label]));

  const webhookBaseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  return (
    <>
      <Topbar
        title={t.couriers.title}
        subtitle={t.couriers.subtitle}
        nav={t.dashboard.nav}
        userInitials={initials}
      />

      <main className="flex flex-1 flex-col gap-4 p-4 sm:p-6">
        <div className="flex justify-end">
          <ConnectCourier canManage={can(membership?.role, "manage_couriers")} couriers={t.couriers} providers={providers} />
        </div>

        <CourierPerformance copy={t.couriers.performance} rows={performance} />

        {error ? (
          <p className="rounded-xl bg-danger-tint px-6 py-5 text-sm text-danger">{error.message}</p>
        ) : accounts.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 rounded-xl bg-surface px-6 py-20 text-center shadow-xs">
            <span className="flex size-12 items-center justify-center rounded-full bg-surface-alt text-brand-dark">
              <Truck className="size-5" aria-hidden="true" />
            </span>
            <h2 className="text-xl font-semibold">{t.couriers.empty.title}</h2>
            <p className="max-w-sm text-sm leading-relaxed text-text-secondary">{t.couriers.empty.body}</p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {accounts.map((account) => (
              <CourierCard
                key={account.id}
                couriers={t.couriers}
                account={account}
                providerLabel={providerLabels.get(account.provider) ?? account.provider}
                webhookBaseUrl={webhookBaseUrl}
              />
            ))}
          </div>
        )}
      </main>
    </>
  );
}
