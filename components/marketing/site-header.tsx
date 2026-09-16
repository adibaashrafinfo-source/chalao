"use client";

import Link from "next/link";
import { Menu, X } from "lucide-react";
import { useEffect, useState } from "react";

import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import type { Messages } from "@/lib/i18n";
import { sectionIds } from "@/lib/marketing/site";
import { cn } from "@/lib/utils";

export function SiteHeader({ common, nav }: { common: Messages["common"]; nav: Messages["marketing"]["nav"] }) {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const links = [
    { href: `/#${sectionIds.features}`, label: nav.features },
    { href: `/#${sectionIds.pricing}`, label: nav.pricing },
    { href: `/#${sectionIds.faq}`, label: nav.faq },
  ];

  return (
    <header
      className={cn(
        "sticky top-0 z-50 transition-[background-color,box-shadow] duration-200",
        scrolled || menuOpen ? "bg-white/80 shadow-xs backdrop-blur-md" : "bg-transparent",
      )}
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-6 px-4 sm:px-6">
        <div className="flex items-center gap-10">
          <Link href="/" aria-label={common.appName} onClick={() => setMenuOpen(false)}>
            <Logo />
          </Link>
          <nav className="hidden items-center gap-1 md:flex">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="rounded-full px-4 py-2 font-display text-sm font-medium text-text-secondary transition-colors hover:bg-surface-alt hover:text-brand-dark"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="hidden items-center gap-2 md:flex">
          <Button variant="ghost" asChild>
            <Link href="/login">{common.login}</Link>
          </Button>
          <Button asChild>
            <Link href="/signup">{common.startFree}</Link>
          </Button>
        </div>

        <Button
          size="icon"
          className="md:hidden"
          aria-label={menuOpen ? nav.closeMenu : nav.openMenu}
          aria-expanded={menuOpen}
          aria-controls="mobile-menu"
          onClick={() => setMenuOpen((open) => !open)}
        >
          {menuOpen ? <X /> : <Menu />}
        </Button>
      </div>

      {menuOpen && (
        <div id="mobile-menu" className="border-t border-border-subtle px-4 pb-6 pt-3 md:hidden">
          <nav className="flex flex-col">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMenuOpen(false)}
                className="rounded-full px-4 py-3 font-display text-base font-medium text-brand-dark hover:bg-surface-alt"
              >
                {link.label}
              </Link>
            ))}
          </nav>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <Button variant="outline" size="lg" asChild>
              <Link href="/login">{common.login}</Link>
            </Button>
            <Button size="lg" asChild>
              <Link href="/signup">{common.startFree}</Link>
            </Button>
          </div>
        </div>
      )}
    </header>
  );
}
