import Link from "next/link";
import { Building2, CreditCard, Globe, Tag } from "lucide-react";

import type { Messages } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/** Tab strip shared by every admin screen. */
export function AdminTabs({
  admin,
  active,
  pendingCount = 0,
}: {
  admin: Messages["admin"];
  active: "organizations" | "payments" | "plans" | "site";
  pendingCount?: number;
}) {
  const tabs = [
    { key: "organizations" as const, label: admin.nav.organizations, href: "/admin", icon: Building2 },
    { key: "payments" as const, label: admin.nav.payments, href: "/admin/payments", icon: CreditCard },
    { key: "plans" as const, label: admin.nav.plans, href: "/admin/plans", icon: Tag },
    { key: "site" as const, label: admin.nav.site, href: "/settings/site", icon: Globe },
  ];

  return (
    <div className="flex w-fit items-center gap-1 rounded-full bg-surface p-1 shadow-xs">
      {tabs.map((tab) => (
        <Link
          key={tab.key}
          href={tab.href}
          aria-current={active === tab.key ? "page" : undefined}
          className={cn(
            "flex items-center gap-2 rounded-full px-4 py-2 font-display text-sm font-medium transition-colors",
            active === tab.key
              ? "bg-brand-dark text-white"
              : "text-text-secondary hover:bg-surface-alt hover:text-brand-dark",
          )}
        >
          <tab.icon className="size-4" aria-hidden="true" />
          {tab.label}
          {tab.key === "payments" && pendingCount > 0 && (
            <span className="rounded-full bg-danger px-1.5 py-0.5 text-[10px] font-semibold text-white">
              {pendingCount}
            </span>
          )}
        </Link>
      ))}
    </div>
  );
}

export function StateBadgeTone(state: string): "success" | "warning" | "danger" | "neutral" {
  if (state === "active") return "success";
  if (state === "grace") return "warning";
  if (state === "suspended") return "neutral";
  return "danger";
}
