import Link from "next/link";

import { Logo } from "@/components/brand/logo";
import { SocialLinks } from "@/components/marketing/social-links";
import type { Messages } from "@/lib/i18n";
import { demoHref, sectionIds } from "@/lib/marketing/site";
import type { SiteSettings } from "@/lib/site-settings";

type FooterLink = { label: string; href?: string };

export function SiteFooter({
  common,
  nav,
  footer,
  settings,
}: {
  common: Messages["common"];
  nav: Messages["marketing"]["nav"];
  footer: Messages["marketing"]["footer"];
  settings: SiteSettings;
}) {
  const columns: { title: string; links: FooterLink[] }[] = [
    {
      title: footer.product,
      links: [
        { label: nav.features, href: `/#${sectionIds.features}` },
        { label: nav.pricing, href: `/#${sectionIds.pricing}` },
        { label: nav.faq, href: `/#${sectionIds.faq}` },
      ],
    },
    {
      title: footer.account,
      links: [
        { label: common.startFree, href: "/signup" },
        { label: common.login, href: "/login" },
        { label: common.bookDemo, href: demoHref },
      ],
    },
    {
      // TODO(Ashraf): add hrefs once privacy policy and terms content exist.
      title: footer.legal,
      links: [{ label: footer.privacy }, { label: footer.terms }],
    },
  ];

  return (
    <footer className="bg-brand-dark text-white">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-[1.5fr_repeat(3,1fr)]">
        <div className="flex flex-col gap-4">
          <Link href="/" aria-label={common.appName} className="w-fit">
            <Logo inverted />
          </Link>
          <p className="max-w-xs text-sm leading-relaxed text-white/60">{footer.tagline}</p>
          <SocialLinks settings={settings} />
        </div>

        {columns.map((column) => (
          <div key={column.title} className="flex flex-col gap-4">
            <h2 className="font-display text-sm font-semibold text-white">{column.title}</h2>
            <ul className="flex flex-col gap-3">
              {column.links.map((link) => (
                <li key={link.label} className="text-sm">
                  {link.href ? (
                    <Link href={link.href} className="text-white/60 transition-colors hover:text-brand-lime">
                      {link.label}
                    </Link>
                  ) : (
                    <span className="flex items-center gap-2 text-white/40">
                      {link.label}
                      <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-white/60">{footer.soon}</span>
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="border-t border-white/10">
        <p className="mx-auto max-w-6xl px-4 py-6 text-xs text-white/50 sm:px-6">
          {footer.rights.replace("{year}", String(new Date().getFullYear()))}
        </p>
      </div>
    </footer>
  );
}
