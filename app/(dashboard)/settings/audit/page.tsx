import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ScrollText } from "lucide-react";

import { Topbar } from "@/components/dashboard/topbar";
import { getUserInitials } from "@/lib/dashboard/user";
import { getMessages } from "@/lib/i18n";
import { getDictionary } from "@/lib/i18n/locale";
import { createClient } from "@/lib/db/server";
import { getMembership } from "@/lib/db/queries";

// Page titles are read once per server, so they stay in English.
const tEn = getMessages("en");

export const metadata: Metadata = { title: tEn.audit.title };

const dateTimeFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

type AuditRow = {
  id: string;
  action: string;
  detail: Record<string, unknown> | null;
  actor_name: string | null;
  actor_email: string | null;
  created_at: string;
};

export default async function AuditPage() {
  // The dictionary is fetched here, not at module level: it is per person.
  const t = await getDictionary();
  const membership = await getMembership();
  if (!membership) redirect("/onboarding");

  const initials = await getUserInitials();

  // The database refuses this to anyone but the owner; the screen says so rather
  // than showing a raw error.
  if (membership.role !== "owner") {
    return (
      <>
        <Topbar title={t.audit.title} subtitle={t.audit.subtitle} nav={t.dashboard.nav} userInitials={initials} />
        <main className="flex-1 p-4 sm:p-6">
          <p className="rounded-xl bg-surface px-6 py-8 text-center text-sm text-text-secondary shadow-xs">
            {t.audit.ownerOnly}
          </p>
        </main>
      </>
    );
  }

  const db = await createClient();
  const { data } = await db.rpc("audit_trail", {
    p_organization_id: membership.organizationId,
    p_limit: 200,
  });

  const rows = (data ?? []) as AuditRow[];
  const labels = t.audit.actions as Record<string, string>;

  return (
    <>
      <Topbar title={t.audit.title} subtitle={t.audit.subtitle} nav={t.dashboard.nav} userInitials={initials} />

      <main className="flex-1 p-4 sm:p-6">
        <div className="mx-auto flex max-w-3xl flex-col gap-4">
          <section className="flex flex-col gap-4 rounded-xl bg-surface p-5 shadow-xs sm:p-6">
            {rows.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-3 px-6 py-12 text-center">
                <span className="flex size-12 items-center justify-center rounded-full bg-surface-alt text-brand-dark">
                  <ScrollText className="size-5" aria-hidden="true" />
                </span>
                <p className="text-sm text-text-secondary">{t.audit.empty}</p>
              </div>
            ) : (
              <ul className="flex flex-col">
                {rows.map((row) => {
                  // Whatever was worth keeping about a row that may no longer
                  // exist, shown as it was stored.
                  const detail = row.detail
                    ? Object.entries(row.detail)
                        .filter(([, value]) => value !== null && value !== "")
                        .map(([key, value]) => `${key}: ${String(value)}`)
                        .join(" · ")
                    : "";

                  return (
                    <li
                      key={row.id}
                      className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border-subtle py-3 last:border-b-0"
                    >
                      <div className="flex min-w-0 flex-col">
                        <span className="text-sm text-brand-dark">{labels[row.action] ?? row.action}</span>
                        <span className="text-xs text-text-muted">
                          {row.actor_name || row.actor_email || "—"}
                          {detail ? ` · ${detail}` : ""}
                        </span>
                      </div>
                      <span className="shrink-0 text-xs tabular-nums text-text-secondary">
                        {dateTimeFormatter.format(new Date(row.created_at))}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <p className="text-xs leading-relaxed text-text-muted">{t.audit.note}</p>
        </div>
      </main>
    </>
  );
}
