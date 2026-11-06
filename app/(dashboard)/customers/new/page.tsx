import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { CustomerForm } from "@/components/customers/customer-form";
import { Topbar } from "@/components/dashboard/topbar";
import { getUserInitials } from "@/lib/dashboard/user";
import { getMessages } from "@/lib/i18n";
import { getDictionary } from "@/lib/i18n/locale";

// Page titles are read once per server, so they stay in English.
const tEn = getMessages("en");

export const metadata: Metadata = { title: tEn.customers.newTitle };

export default async function NewCustomerPage() {
  // The dictionary is fetched here, not at module level: it is per person.
  const t = await getDictionary();
  const initials = await getUserInitials();

  return (
    <>
      <Topbar
        title={t.customers.newTitle}
        subtitle={t.customers.newSubtitle}
        nav={t.dashboard.nav}
        userInitials={initials}
      />

      <main className="flex-1 p-4 sm:p-6">
        <div className="mx-auto flex max-w-3xl flex-col gap-4">
          <Link
            href="/customers"
            className="flex w-fit items-center gap-1.5 text-sm text-text-secondary hover:text-brand-dark"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            {t.customers.backToList}
          </Link>
          <CustomerForm customers={t.customers} />
        </div>
      </main>
    </>
  );
}
