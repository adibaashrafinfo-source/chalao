import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { Logo } from "@/components/brand/logo";
import { getMessages } from "@/lib/i18n";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const t = getMessages("en");

  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden bg-app">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-32 -top-32 size-[420px] rounded-full bg-brand-lime/30 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-40 -left-40 size-[360px] rounded-full bg-brand-lime-tint blur-3xl"
      />

      <header className="relative mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-5 sm:px-6">
        <Link href="/" aria-label={t.common.appName}>
          <Logo />
        </Link>
        <Link
          href="/"
          className="flex items-center gap-1.5 rounded-full px-3 py-2 font-display text-sm font-medium text-text-secondary hover:bg-surface hover:text-brand-dark"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          <span className="hidden sm:inline">{t.common.backHome}</span>
        </Link>
      </header>

      <main className="relative flex flex-1 items-center justify-center px-4 pb-16 pt-4 sm:px-6">{children}</main>
    </div>
  );
}
