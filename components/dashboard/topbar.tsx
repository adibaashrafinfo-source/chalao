import { CircleQuestionMark, Settings } from "lucide-react";

import { DashboardSearch } from "@/components/dashboard/dashboard-search";

import type { Messages } from "@/lib/i18n";

// Brief §3.5: page name + grey subtitle on the left, search and circular icon buttons on the right.
export function Topbar({
  title,
  subtitle,
  nav,
  userInitials,
  action,
}: {
  title: string;
  subtitle: string;
  nav: Messages["dashboard"]["nav"];
  userInitials: string;
  action?: React.ReactNode;
}) {
  return (
    <header data-print-hide className="flex flex-col gap-4 border-b border-border-subtle bg-surface px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex flex-col">
        <h1 className="font-display text-lg font-bold text-brand-dark">{title}</h1>
        <p className="text-sm text-text-secondary">{subtitle}</p>
      </div>

      <div className="flex items-center gap-2">
        <DashboardSearch nav={nav} />
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-surface-alt text-brand-dark">
          <Settings className="size-4" aria-hidden="true" />
        </span>
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-surface-alt text-brand-dark">
          <CircleQuestionMark className="size-4" aria-hidden="true" />
        </span>
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand-dark font-display text-xs font-semibold text-white">
          {userInitials}
        </span>
        {action}
      </div>
    </header>
  );
}
