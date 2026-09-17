import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Info } from "lucide-react";

import { AdminTabs } from "@/components/admin/admin-shell";
import { PlanEditor, type EditablePlan } from "@/components/admin/plan-editor";
import { Topbar } from "@/components/dashboard/topbar";
import { listOrganizations, listSubmissions } from "@/lib/admin/queries";
import { getUserInitials } from "@/lib/dashboard/user";
import { getMessages } from "@/lib/i18n";
import { isPlatformAdmin } from "@/lib/site-settings";
import { createClient } from "@/lib/supabase/server";

const t = getMessages("en");

export const metadata: Metadata = { title: t.admin.plans.title };

export default async function AdminPlansPage() {
  const initials = await getUserInitials();
  if (!(await isPlatformAdmin())) notFound();

  const supabase = await createClient();
  const [{ data: planRows }, organizations, pending] = await Promise.all([
    supabase
      .from("subscription_plans")
      .select("code, name, tagline, monthly_price, order_limit, user_limit, is_featured, is_active")
      .order("sort_order"),
    listOrganizations(),
    listSubmissions("pending"),
  ]);

  // How many businesses each plan actually carries, so a price change isn't made blind.
  const counts = new Map<string, number>();
  for (const organization of organizations) {
    counts.set(organization.plan_code, (counts.get(organization.plan_code) ?? 0) + 1);
  }

  const plans: EditablePlan[] = (planRows ?? []).map((plan) => ({
    code: plan.code as string,
    name: plan.name as string,
    tagline: plan.tagline as string | null,
    monthly_price: Number(plan.monthly_price),
    order_limit: plan.order_limit as number | null,
    user_limit: plan.user_limit as number | null,
    is_featured: plan.is_featured as boolean,
    is_active: plan.is_active as boolean,
    subscribers: counts.get(plan.code as string) ?? 0,
  }));

  return (
    <>
      <Topbar
        title={t.admin.plans.title}
        subtitle={t.admin.plans.subtitle}
        nav={t.dashboard.nav}
        userInitials={initials}
      />

      <main className="flex flex-1 flex-col gap-4 p-4 sm:p-6">
        <AdminTabs admin={t.admin} active="plans" pendingCount={pending.length} />

        <p className="flex items-start gap-2 rounded-xl bg-surface px-4 py-3 text-sm text-text-secondary shadow-xs">
          <Info className="mt-0.5 size-4 shrink-0 text-info" aria-hidden="true" />
          {t.admin.plans.liveNote}
        </p>

        {plans.map((plan) => (
          <PlanEditor key={plan.code} copy={t.admin.plans} plan={plan} />
        ))}
      </main>
    </>
  );
}
