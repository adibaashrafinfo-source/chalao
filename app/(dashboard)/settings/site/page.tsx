import type { Metadata } from "next";
import { ShieldAlert } from "lucide-react";

import { Topbar } from "@/components/dashboard/topbar";
import { SiteSettingsForm } from "@/components/settings/site-settings-form";
import { getUserInitials } from "@/lib/dashboard/user";
import { getMessages } from "@/lib/i18n";
import { getDictionary } from "@/lib/i18n/locale";
import { getSiteSettings, isPlatformAdmin } from "@/lib/site-settings";

// Page titles are read once per server, so they stay in English.
const tEn = getMessages("en");

export const metadata: Metadata = { title: tEn.settings.site.title };

export default async function SiteSettingsPage() {
  // The dictionary is fetched here, not at module level: it is per person.
  const t = await getDictionary();
  const initials = await getUserInitials();
  const [admin, settings] = await Promise.all([isPlatformAdmin(), getSiteSettings()]);

  return (
    <>
      <Topbar
        title={t.settings.site.title}
        subtitle={t.settings.site.subtitle}
        nav={t.dashboard.nav}
        userInitials={initials}
      />

      <main className="flex-1 p-4 sm:p-6">
        <div className="mx-auto max-w-3xl">
          {admin ? (
            <SiteSettingsForm settings={settings} copy={t.settings.site} />
          ) : (
            // Not an error, just not your page — the database refuses the write anyway.
            <div className="flex flex-col items-center justify-center gap-3 rounded-xl bg-surface px-6 py-16 text-center shadow-xs">
              <span className="flex size-12 items-center justify-center rounded-full bg-surface-alt text-brand-dark">
                <ShieldAlert className="size-5" aria-hidden="true" />
              </span>
              <p className="max-w-sm text-sm leading-relaxed text-text-secondary">{t.settings.site.adminOnly}</p>
            </div>
          )}
        </div>
      </main>
    </>
  );
}
