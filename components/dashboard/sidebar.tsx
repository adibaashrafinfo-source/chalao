"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Banknote,
  Boxes,
  ChevronDown,
  CircleQuestionMark,
  CreditCard,
  LayoutDashboard,
  LogOut,
  MessagesSquare,
  Package,
  PackageX,
  Plug,
  Settings,
  ShieldCheck,
  ShoppingBag,
  SlidersHorizontal,
  Truck,
  UserPlus,
  Users,
  type LucideIcon,
} from "lucide-react";

import { signOutAction } from "@/app/(auth)/actions";
import { Logo } from "@/components/brand/logo";
import type { Messages } from "@/lib/i18n";
import { cn } from "@/lib/utils";

// Brief §3.5. The "AI Assistant" slot is deliberately absent until a later phase.
export function Sidebar({
  nav,
  support,
  organizationName,
  role,
  isPlatformAdmin = false,
}: {
  nav: Messages["dashboard"]["nav"];
  support: Messages["dashboard"]["support"];
  organizationName: string;
  role: string;
  /** Only the people who run Chalao itself see the admin link. */
  isPlatformAdmin?: boolean;
}) {
  const pathname = usePathname();

  const mainMenu: { href: string; label: string; icon: LucideIcon }[] = [
    { href: "/dashboard", label: nav.dashboard, icon: LayoutDashboard },
    { href: "/inbox", label: nav.inbox, icon: MessagesSquare },
    { href: "/orders", label: nav.orders, icon: ShoppingBag },
    { href: "/customers", label: nav.customers, icon: Users },
    { href: "/products", label: nav.products, icon: Package },
    { href: "/inventory", label: nav.inventory, icon: Boxes },
    { href: "/couriers", label: nav.couriers, icon: Truck },
    { href: "/cod", label: nav.cod, icon: Banknote },
    { href: "/returns", label: nav.returns, icon: PackageX },
  ];

  const preference: { href: string; label: string; icon: LucideIcon }[] = [
    ...(isPlatformAdmin ? [{ href: "/admin", label: nav.admin, icon: ShieldCheck }] : []),
    { href: "/settings/channels", label: nav.channels, icon: Plug },
    { href: "/settings/orders", label: nav.orderRules, icon: SlidersHorizontal },
    { href: "/settings/team", label: nav.team, icon: UserPlus },
    { href: "/settings/billing", label: nav.billing, icon: CreditCard },
    { href: "/settings/organization", label: nav.settings, icon: Settings },
    { href: "/help", label: nav.help, icon: CircleQuestionMark },
  ];

  const initials =
    organizationName
      .split(/\s+/)
      .slice(0, 2)
      .map((word) => word[0]?.toUpperCase() ?? "")
      .join("") || "OS";

  const renderLink = ({ href, label, icon: Icon }: { href: string; label: string; icon: LucideIcon }) => {
    const active = pathname === href || pathname.startsWith(`${href}/`);
    return (
      <Link
        key={href}
        href={href}
        aria-current={active ? "page" : undefined}
        className={cn(
          "flex items-center gap-3 rounded-full px-3 py-2.5 text-sm transition-colors",
          active
            ? "bg-surface-alt font-display font-semibold text-brand-dark"
            : "text-text-secondary hover:bg-surface-alt hover:text-brand-dark",
        )}
      >
        <Icon className="size-4.5 shrink-0" aria-hidden="true" />
        {label}
      </Link>
    );
  };

  return (
    <aside className="hidden w-[260px] shrink-0 flex-col gap-5 border-r border-border-subtle bg-surface p-4 lg:flex">
      <Link href="/dashboard" className="flex items-center px-1 pt-1">
        <Logo height="h-8" />
      </Link>

      <div className="flex items-center gap-2.5 rounded-full bg-surface-alt p-1.5 pr-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-lime font-display text-xs font-bold text-brand-dark">
          {initials}
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate font-display text-sm font-semibold text-brand-dark">{organizationName}</span>
          <span className="truncate text-xs capitalize text-text-secondary">{role}</span>
        </span>
        <ChevronDown className="size-4 shrink-0 text-text-secondary" aria-hidden="true" />
      </div>

      <nav className="flex flex-col gap-1">
        <p className="px-3 pb-1 text-[11px] font-semibold tracking-[0.12em] text-text-muted">{nav.mainMenu}</p>
        {mainMenu.map(renderLink)}
      </nav>

      <nav className="flex flex-col gap-1">
        <p className="px-3 pb-1 text-[11px] font-semibold tracking-[0.12em] text-text-muted">{nav.preference}</p>
        {preference.map(renderLink)}
      </nav>

      <div className="mt-auto flex flex-col gap-3">
        {/* Phase 1: support card, not an upgrade CTA (no billing yet). */}
        <div className="flex flex-col gap-2 rounded-xl bg-brand-dark p-4">
          <p className="font-display text-sm font-semibold leading-snug text-white">{support.title}</p>
          <p className="text-xs leading-relaxed text-white/60">{support.body}</p>
          <span className="mt-1 w-fit rounded-full bg-brand-lime px-3 py-1.5 font-display text-xs font-semibold text-brand-dark">
            {support.cta}
          </span>
        </div>

        <form action={signOutAction}>
          <button
            type="submit"
            className="flex w-full items-center gap-3 rounded-full px-3 py-2.5 text-sm text-text-secondary transition-colors hover:bg-surface-alt hover:text-brand-dark"
          >
            <LogOut className="size-4.5 shrink-0" aria-hidden="true" />
            {nav.signOut}
          </button>
        </form>
      </div>
    </aside>
  );
}
