import Link from "next/link";

import type { Messages } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export function InventoryTabs({
  inventory,
  active,
}: {
  inventory: Messages["inventory"];
  active: "levels" | "movements";
}) {
  const tabs = [
    { key: "levels" as const, label: inventory.tabs.levels, href: "/inventory" },
    { key: "movements" as const, label: inventory.tabs.movements, href: "/inventory?tab=movements" },
  ];

  return (
    <div className="flex w-fit items-center gap-1 rounded-full bg-surface p-1 shadow-xs">
      {tabs.map((tab) => (
        <Link
          key={tab.key}
          href={tab.href}
          aria-current={active === tab.key ? "page" : undefined}
          className={cn(
            "rounded-full px-4 py-2 font-display text-sm font-medium transition-colors",
            active === tab.key
              ? "bg-brand-dark text-white"
              : "text-text-secondary hover:bg-surface-alt hover:text-brand-dark",
          )}
        >
          {tab.label}
        </Link>
      ))}
    </div>
  );
}
