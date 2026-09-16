import {
  Bell,
  Boxes,
  ChevronDown,
  CircleQuestionMark,
  Clock,
  LayoutDashboard,
  Package,
  PackageX,
  Search,
  Settings,
  ShoppingBag,
  TrendingDown,
  TrendingUp,
  TriangleAlert,
  Truck,
  Users,
  type LucideIcon,
} from "lucide-react";

import { LogoMark } from "@/components/brand/logo";
import { formatBDT } from "@/lib/format";
import { cn } from "@/lib/utils";

// Marketing mockup of the dashboard specified in the brief (§3.5, §6.2), drawn at a fixed
// 1120px design width and scaled down with `zoom`. All figures are sample data, and the
// aria-label says so — this is a design illustration, not a screenshot of a real account.

const navMain: { label: string; icon: LucideIcon; badge?: string }[] = [
  { label: "Dashboard", icon: LayoutDashboard },
  { label: "Orders", icon: ShoppingBag, badge: "12" },
  { label: "Customers", icon: Users },
  { label: "Products", icon: Package },
  { label: "Inventory", icon: Boxes },
  { label: "Couriers", icon: Truck },
];

const stats = [
  { label: "Today's Revenue", value: formatBDT(185450), delta: "+12.4%", up: true, hero: true },
  { label: "Orders Today", value: "48", delta: "+8", up: true },
  { label: "Delivered", value: "32", delta: "+5", up: true },
  { label: "Pending", value: "9", delta: "-2", up: false },
];

// [revenue bar %, orders bar %] per weekday
const chartBars: [number, number][] = [
  [52, 34],
  [68, 45],
  [44, 30],
  [80, 56],
  [62, 41],
  [92, 64],
  [74, 50],
];
const chartDays = ["Sat", "Sun", "Mon", "Tue", "Wed", "Thu", "Fri"];

const alerts: { icon: LucideIcon; title: string; meta: string; chip: string; tone: "danger" | "warning" }[] = [
  { icon: PackageX, title: "Cotton Kurti · M", meta: "Low stock", chip: "3 left", tone: "danger" },
  { icon: Clock, title: "Order #1042", meta: "Not confirmed yet", chip: "26h", tone: "warning" },
  { icon: Truck, title: "Shipment #SF-8871", meta: "No courier update", chip: "48h", tone: "warning" },
  { icon: TriangleAlert, title: "Silk Scarf · Red", meta: "Low stock", chip: "5 left", tone: "danger" },
];

const orders: { id: string; customer: string; phone: string; total: number; status: string; tone: string; source: string }[] =
  [
    {
      id: "#1046",
      customer: "Nusrat J.",
      phone: "017••••892",
      total: 2450,
      status: "Delivered",
      tone: "bg-success-tint text-success",
      source: "Facebook",
    },
    {
      id: "#1045",
      customer: "Rakib H.",
      phone: "019••••117",
      total: 1890,
      status: "Shipped",
      tone: "bg-brand-lime-tint text-brand-dark",
      source: "Instagram",
    },
    {
      id: "#1044",
      customer: "Tanzila A.",
      phone: "018••••430",
      total: 3600,
      status: "Processing",
      tone: "bg-warning-tint text-warning",
      source: "WhatsApp",
    },
    {
      id: "#1043",
      customer: "Imran K.",
      phone: "016••••255",
      total: 990,
      status: "Pending",
      tone: "bg-danger-tint text-danger",
      source: "Facebook",
    },
  ];

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="px-3 text-[10px] font-semibold tracking-[0.14em] text-text-muted">{children}</p>;
}

export function DashboardPreview({ label }: { label: string }) {
  return (
    <div
      role="img"
      aria-label={label}
      className="relative mx-auto w-fit overflow-hidden rounded-2xl ring-1 ring-black/5 shadow-lg"
    >
      {/* Light sweep across the frame */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 left-0 z-20 w-1/3 bg-gradient-to-r from-transparent via-white/45 to-transparent animate-shine motion-reduce:hidden"
      />

      <div className="w-[1120px] origin-top [zoom:0.3] sm:[zoom:0.5] md:[zoom:0.62] lg:[zoom:0.8] xl:[zoom:0.9]">
        {/* Browser chrome */}
        <div className="flex items-center gap-3 border-b border-border-subtle bg-surface px-5 py-3">
          <div className="flex gap-1.5">
            <span className="size-2.5 rounded-full bg-border-subtle" />
            <span className="size-2.5 rounded-full bg-border-subtle" />
            <span className="size-2.5 rounded-full bg-border-subtle" />
          </div>
          <div className="mx-auto h-6 w-72 rounded-full bg-surface-alt" />
        </div>

        <div className="flex bg-app">
          {/* Sidebar */}
          <aside className="flex w-[240px] shrink-0 flex-col gap-4 border-r border-border-subtle bg-surface p-4">
            <div className="flex items-center gap-2 px-1 pt-1">
              <LogoMark className="size-7" />
              <span className="font-display text-sm font-bold text-brand-dark">F-Commerce OS</span>
            </div>

            <div className="flex items-center gap-2 rounded-full bg-surface-alt p-1.5 pr-3">
              <span className="flex size-8 items-center justify-center rounded-full bg-brand-lime font-display text-xs font-bold text-brand-dark">
                DS
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate font-display text-xs font-semibold text-brand-dark">Demo Store</span>
                <span className="truncate text-[10px] text-text-secondary">Owner</span>
              </span>
              <ChevronDown className="size-3.5 text-text-secondary" />
            </div>

            <div className="flex flex-col gap-1">
              <SectionLabel>MAIN MENU</SectionLabel>
              {navMain.map((item, i) => {
                const active = i === 0;
                return (
                  <span
                    key={item.label}
                    className={cn(
                      "flex items-center gap-2.5 rounded-full px-3 py-2 text-xs",
                      active ? "bg-surface-alt font-display font-semibold text-brand-dark" : "text-text-secondary",
                    )}
                  >
                    <item.icon className={cn("size-4", active ? "text-brand-dark" : "text-text-secondary")} />
                    <span className="flex-1">{item.label}</span>
                    {item.badge && (
                      <span className="rounded-full bg-brand-lime px-1.5 py-0.5 text-[10px] font-semibold text-brand-dark">
                        {item.badge}
                      </span>
                    )}
                  </span>
                );
              })}
            </div>

            <div className="flex flex-col gap-1">
              <SectionLabel>PREFERENCE</SectionLabel>
              <span className="flex items-center gap-2.5 rounded-full px-3 py-2 text-xs text-text-secondary">
                <Settings className="size-4" />
                Settings
              </span>
              <span className="flex items-center gap-2.5 rounded-full px-3 py-2 text-xs text-text-secondary">
                <CircleQuestionMark className="size-4" />
                Help
              </span>
            </div>

            {/* Support card (billing/upgrade CTA comes later) */}
            <div className="mt-auto flex flex-col gap-2 rounded-xl bg-brand-dark p-4">
              <p className="font-display text-xs font-semibold leading-snug text-white">
                Need help getting started?
              </p>
              <p className="text-[10px] leading-relaxed text-white/60">
                We&apos;ll set up your first courier and products with you.
              </p>
              <span className="mt-1 w-fit rounded-full bg-brand-lime px-3 py-1.5 font-display text-[10px] font-semibold text-brand-dark">
                Talk to support
              </span>
            </div>
          </aside>

          {/* Main column */}
          <div className="flex min-w-0 flex-1 flex-col">
            {/* Top bar */}
            <header className="flex items-center justify-between border-b border-border-subtle bg-surface px-6 py-3.5">
              <div className="flex flex-col">
                <h3 className="font-display text-base font-bold text-brand-dark">Dashboard</h3>
                <p className="text-[11px] text-text-secondary">Today&apos;s orders, revenue and alerts in one place</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="flex h-9 w-56 items-center gap-2 rounded-full bg-surface-alt px-3.5 text-xs text-text-muted">
                  <Search className="size-3.5" />
                  <span className="flex-1">Search orders, customers…</span>
                  <kbd className="rounded-md bg-surface px-1.5 py-0.5 text-[10px] text-text-secondary">⌘F</kbd>
                </span>
                <span className="flex size-9 items-center justify-center rounded-full bg-surface-alt text-brand-dark">
                  <Bell className="size-4" />
                </span>
                <span className="flex size-9 items-center justify-center rounded-full bg-surface-alt text-brand-dark">
                  <Settings className="size-4" />
                </span>
                <span className="flex size-9 items-center justify-center rounded-full bg-brand-dark font-display text-[11px] font-semibold text-white">
                  AR
                </span>
              </div>
            </header>

            {/* Content */}
            <div className="flex flex-col gap-4 p-6">
              {/* Stat cards */}
              <div className="grid grid-cols-4 gap-4">
                {stats.map((stat, i) => (
                  <div
                    key={stat.label}
                    style={{ animationDelay: `${300 + i * 90}ms` }}
                    className={cn(
                      "flex animate-rise flex-col gap-2 rounded-xl p-4 shadow-xs motion-reduce:animate-none",
                      stat.hero ? "bg-brand-lime" : "bg-surface",
                    )}
                  >
                    <p className={cn("text-[11px]", stat.hero ? "text-brand-dark/70" : "text-text-secondary")}>
                      {stat.label}
                    </p>
                    <p className="font-display text-2xl font-bold tabular-nums text-brand-dark">{stat.value}</p>
                    <p
                      className={cn(
                        "flex items-center gap-1 text-[11px] font-medium",
                        stat.up ? "text-success" : "text-danger",
                        stat.hero && "text-brand-dark/80",
                      )}
                    >
                      {stat.up ? <TrendingUp className="size-3.5" /> : <TrendingDown className="size-3.5" />}
                      {stat.delta}
                      <span className={cn("font-normal", stat.hero ? "text-brand-dark/60" : "text-text-muted")}>
                        vs yesterday
                      </span>
                    </p>
                  </div>
                ))}
              </div>

              {/* Chart + alerts */}
              <div className="grid grid-cols-3 gap-4">
                <div
                  style={{ animationDelay: "700ms" }}
                  className="col-span-2 flex animate-rise flex-col gap-5 rounded-xl bg-surface p-5 shadow-xs motion-reduce:animate-none"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <h4 className="font-display text-sm font-semibold text-brand-dark">Revenue &amp; Orders</h4>
                      <span className="flex items-center gap-1 rounded-full bg-brand-lime-tint px-2 py-0.5 text-[10px] font-medium text-brand-dark">
                        <span className="size-1.5 animate-pulse rounded-full bg-success motion-reduce:animate-none" />
                        Live
                      </span>
                    </div>
                    <div className="flex items-center gap-1 rounded-full bg-surface-alt p-1">
                      {["Today", "7 Days", "30 Days"].map((range, i) => (
                        <span
                          key={range}
                          className={cn(
                            "rounded-full px-2.5 py-1 text-[10px]",
                            i === 1 ? "bg-brand-lime font-semibold text-brand-dark" : "text-text-secondary",
                          )}
                        >
                          {range}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-end gap-4">
                    <div className="flex h-40 flex-col justify-between py-1 text-[10px] tabular-nums text-text-muted">
                      {["2L", "1.5L", "1L", "50k", "0"].map((tick) => (
                        <span key={tick}>{tick}</span>
                      ))}
                    </div>
                    <div className="relative flex h-40 flex-1 items-end justify-between gap-3">
                      {[0, 1, 2, 3].map((i) => (
                        <span
                          key={i}
                          style={{ bottom: `${i * 25}%` }}
                          className="absolute inset-x-0 border-t border-dashed border-border-subtle"
                        />
                      ))}
                      {chartBars.map(([revenue, ordersHeight], i) => (
                        <div key={chartDays[i]} className="relative flex h-full flex-1 items-end justify-center gap-1.5">
                          <span
                            style={{ height: `${revenue}%`, animationDelay: `${800 + i * 70}ms` }}
                            className="w-5 origin-bottom animate-bar-grow rounded-full bg-brand-dark motion-reduce:animate-none"
                          />
                          <span
                            style={{ height: `${ordersHeight}%`, animationDelay: `${860 + i * 70}ms` }}
                            className="w-5 origin-bottom animate-bar-grow rounded-full bg-brand-lime motion-reduce:animate-none"
                          />
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center justify-between pl-10">
                    {chartDays.map((day) => (
                      <span key={day} className="flex-1 text-center text-[10px] text-text-muted">
                        {day}
                      </span>
                    ))}
                  </div>

                  <div className="flex items-center gap-4 border-t border-border-subtle pt-3 text-[10px] text-text-secondary">
                    <span className="flex items-center gap-1.5">
                      <span className="size-2 rounded-full bg-brand-dark" /> Revenue
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="size-2 rounded-full bg-brand-lime" /> Orders
                    </span>
                  </div>
                </div>

                <div
                  style={{ animationDelay: "800ms" }}
                  className="flex animate-rise flex-col gap-3 rounded-xl bg-surface p-5 shadow-xs motion-reduce:animate-none"
                >
                  <div className="flex items-center justify-between">
                    <h4 className="font-display text-sm font-semibold text-brand-dark">Alerts</h4>
                    <span className="rounded-full bg-danger-tint px-2 py-0.5 text-[10px] font-semibold text-danger">
                      4 new
                    </span>
                  </div>
                  {alerts.map((alert, i) => (
                    <div
                      key={alert.title}
                      style={{ animationDelay: `${900 + i * 90}ms` }}
                      className="flex animate-rise items-center gap-2.5 rounded-lg bg-surface-alt p-2.5 motion-reduce:animate-none"
                    >
                      <span
                        className={cn(
                          "flex size-8 shrink-0 items-center justify-center rounded-full",
                          alert.tone === "danger" ? "bg-danger-tint text-danger" : "bg-warning-tint text-warning",
                        )}
                      >
                        <alert.icon className="size-4" />
                      </span>
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate font-display text-[11px] font-semibold text-brand-dark">
                          {alert.title}
                        </span>
                        <span className="truncate text-[10px] text-text-secondary">{alert.meta}</span>
                      </span>
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-[10px] font-medium",
                          alert.tone === "danger" ? "bg-danger-tint text-danger" : "bg-warning-tint text-warning",
                        )}
                      >
                        {alert.chip}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Recent orders */}
              <div
                style={{ animationDelay: "1000ms" }}
                className="flex animate-rise flex-col gap-3 rounded-xl bg-surface p-5 shadow-xs motion-reduce:animate-none"
              >
                <div className="flex items-center justify-between">
                  <h4 className="font-display text-sm font-semibold text-brand-dark">Recent Orders</h4>
                  <span className="rounded-full bg-surface-alt px-3 py-1 font-display text-[10px] font-semibold text-brand-dark">
                    View all
                  </span>
                </div>

                <div className="grid grid-cols-[0.6fr_1.4fr_0.8fr_0.8fr_0.8fr] gap-3 border-b border-border-subtle pb-2 text-[10px] font-medium tracking-wide text-text-muted">
                  <span>ORDER</span>
                  <span>CUSTOMER</span>
                  <span className="text-right">TOTAL</span>
                  <span>STATUS</span>
                  <span>SOURCE</span>
                </div>

                {orders.map((order, i) => (
                  <div
                    key={order.id}
                    style={{ animationDelay: `${1050 + i * 80}ms` }}
                    className="grid animate-rise grid-cols-[0.6fr_1.4fr_0.8fr_0.8fr_0.8fr] items-center gap-3 text-[11px] motion-reduce:animate-none"
                  >
                    <span className="font-display font-semibold text-brand-dark">{order.id}</span>
                    <span className="flex flex-col">
                      <span className="font-medium text-text-primary">{order.customer}</span>
                      <span className="text-[10px] tabular-nums text-text-muted">{order.phone}</span>
                    </span>
                    <span className="text-right font-medium tabular-nums text-text-primary">
                      {formatBDT(order.total)}
                    </span>
                    <span>
                      <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium", order.tone)}>
                        {order.status}
                      </span>
                    </span>
                    <span className="text-text-secondary">{order.source}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
