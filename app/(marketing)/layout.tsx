import type { Metadata } from "next";

import { SiteFooter } from "@/components/marketing/site-footer";
import { SiteHeader } from "@/components/marketing/site-header";
import { getMessages } from "@/lib/i18n";
import { getSiteSettings } from "@/lib/site-settings";

const t = getMessages("bn");

export const metadata: Metadata = {
  title: { absolute: t.marketing.meta.title },
  description: t.marketing.meta.description,
  openGraph: {
    title: t.marketing.meta.title,
    description: t.marketing.meta.description,
    locale: "bn_BD",
    type: "website",
  },
};

export default async function MarketingLayout({ children }: { children: React.ReactNode }) {
  // Social links are managed from Settings → Site (platform admin only).
  const settings = await getSiteSettings();

  return (
    <div lang="bn" className="flex min-h-dvh flex-col bg-app">
      <SiteHeader common={t.common} nav={t.marketing.nav} />
      <main className="flex-1">{children}</main>
      <SiteFooter
        common={t.common}
        nav={t.marketing.nav}
        footer={t.marketing.footer}
        settings={settings}
      />
    </div>
  );
}
