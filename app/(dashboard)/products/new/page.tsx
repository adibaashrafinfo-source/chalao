import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { Topbar } from "@/components/dashboard/topbar";
import { ProductForm } from "@/components/products/product-form";
import { getUserInitials } from "@/lib/dashboard/user";
import { getMessages } from "@/lib/i18n";

const t = getMessages("en");

export const metadata: Metadata = { title: t.products.newTitle };

export default async function NewProductPage() {
  const initials = await getUserInitials();

  return (
    <>
      <Topbar
        title={t.products.newTitle}
        subtitle={t.products.newSubtitle}
        nav={t.dashboard.nav}
        userInitials={initials}
      />

      <main className="flex-1 p-4 sm:p-6">
        <div className="mx-auto flex max-w-3xl flex-col gap-4">
          <Link
            href="/products"
            className="flex w-fit items-center gap-1.5 text-sm text-text-secondary hover:text-brand-dark"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            {t.products.backToList}
          </Link>
          <ProductForm products={t.products} />
        </div>
      </main>
    </>
  );
}
