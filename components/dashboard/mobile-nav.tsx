"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { LogOut, Menu, X } from "lucide-react";

import { signOutAction } from "@/app/(auth)/actions";
import { Logo } from "@/components/brand/logo";
import { dashboardNav, type NavItem } from "@/lib/dashboard/nav";
import type { Messages } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/**
 * The phone's navigation. The sidebar is hidden below lg, which left a seller on
 * a phone — which is most of them, most of the day — with no way to move between
 * screens at all.
 */
export function MobileNav({
  nav,
  organizationName,
  role,
  isPlatformAdmin = false,
}: {
  nav: Messages["dashboard"]["nav"];
  organizationName: string;
  role: string;
  isPlatformAdmin?: boolean;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const { mainMenu, preference } = dashboardNav(nav, isPlatformAdmin);

  // Any navigation closes it, including the back button.
  useEffect(() => setOpen(false), [pathname]);

  // A drawer that scrolls the page behind it feels broken.
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  const renderLink = ({ href, label, icon: Icon }: NavItem) => {
    const active = pathname === href || pathname.startsWith(`${href}/`);
    return (
      <Link
        key={href}
        href={href}
        aria-current={active ? "page" : undefined}
        className={cn(
          "flex items-center gap-3 rounded-full px-3 py-3 text-sm transition-colors",
          active
            ? "bg-surface-alt font-display font-semibold text-brand-dark"
            : "text-text-secondary hover:bg-surface-alt hover:text-brand-dark",
        )}
      >
        <Icon className="size-5 shrink-0" aria-hidden="true" />
        {label}
      </Link>
    );
  };

  return (
    <>
      <header data-print-hide className="flex items-center justify-between gap-3 border-b border-border-subtle bg-surface px-4 py-3 lg:hidden">
        <Link href="/dashboard" aria-label={organizationName}>
          <Logo height="h-7" />
        </Link>
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={nav.openMenu}
          aria-expanded={open}
          className="flex size-10 items-center justify-center rounded-full bg-surface-alt text-brand-dark"
        >
          <Menu className="size-5" aria-hidden="true" />
        </button>
      </header>

      {open ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label={nav.closeMenu}
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-brand-dark/40"
          />

          <nav className="absolute inset-y-0 right-0 flex w-[82%] max-w-xs flex-col gap-4 overflow-y-auto bg-surface p-4 shadow-lg">
            <div className="flex items-center justify-between gap-3">
              <span className="flex min-w-0 flex-col">
                <span className="truncate font-display text-sm font-semibold text-brand-dark">
                  {organizationName}
                </span>
                <span className="truncate text-xs capitalize text-text-secondary">{role}</span>
              </span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label={nav.closeMenu}
                className="flex size-10 shrink-0 items-center justify-center rounded-full bg-surface-alt text-brand-dark"
              >
                <X className="size-5" aria-hidden="true" />
              </button>
            </div>

            <div className="flex flex-col gap-1">
              <p className="px-3 pb-1 text-[11px] font-semibold tracking-[0.12em] text-text-muted">
                {nav.mainMenu}
              </p>
              {mainMenu.map(renderLink)}
            </div>

            <div className="flex flex-col gap-1">
              <p className="px-3 pb-1 text-[11px] font-semibold tracking-[0.12em] text-text-muted">
                {nav.preference}
              </p>
              {preference.map(renderLink)}
            </div>

            <form action={signOutAction} className="mt-auto pt-2">
              <button
                type="submit"
                className="flex w-full items-center gap-3 rounded-full px-3 py-3 text-sm text-text-secondary transition-colors hover:bg-surface-alt hover:text-brand-dark"
              >
                <LogOut className="size-5 shrink-0" aria-hidden="true" />
                {nav.signOut}
              </button>
            </form>
          </nav>
        </div>
      ) : null}
    </>
  );
}
