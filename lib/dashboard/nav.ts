import {
  Banknote,
  Boxes,
  CircleQuestionMark,
  CreditCard,
  LayoutDashboard,
  MessagesSquare,
  Package,
  PackageX,
  Plug,
  Settings,
  ShieldCheck,
  ShoppingBag,
  SlidersHorizontal,
  TrendingUp,
  Truck,
  UserPlus,
  Users,
  type LucideIcon,
} from "lucide-react";

import type { Messages } from "@/lib/i18n";

export type NavItem = { href: string; label: string; icon: LucideIcon };

/**
 * One list, used by the sidebar on a laptop and the drawer on a phone. Two
 * copies would drift the first time a page was added — and most sellers here
 * work from a phone.
 */
export function dashboardNav(
  nav: Messages["dashboard"]["nav"],
  isPlatformAdmin: boolean,
): { mainMenu: NavItem[]; preference: NavItem[] } {
  return {
    mainMenu: [
      { href: "/dashboard", label: nav.dashboard, icon: LayoutDashboard },
      { href: "/inbox", label: nav.inbox, icon: MessagesSquare },
      { href: "/orders", label: nav.orders, icon: ShoppingBag },
      { href: "/customers", label: nav.customers, icon: Users },
      { href: "/products", label: nav.products, icon: Package },
      { href: "/inventory", label: nav.inventory, icon: Boxes },
      { href: "/couriers", label: nav.couriers, icon: Truck },
      { href: "/cod", label: nav.cod, icon: Banknote },
      { href: "/returns", label: nav.returns, icon: PackageX },
      { href: "/profit", label: nav.profit, icon: TrendingUp },
    ],
    preference: [
      ...(isPlatformAdmin ? [{ href: "/admin", label: nav.admin, icon: ShieldCheck }] : []),
      { href: "/settings/channels", label: nav.channels, icon: Plug },
      { href: "/settings/orders", label: nav.orderRules, icon: SlidersHorizontal },
      { href: "/settings/team", label: nav.team, icon: UserPlus },
      { href: "/settings/billing", label: nav.billing, icon: CreditCard },
      { href: "/settings/organization", label: nav.settings, icon: Settings },
      { href: "/help", label: nav.help, icon: CircleQuestionMark },
    ],
  };
}
