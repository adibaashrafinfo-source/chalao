import type { Metadata } from "next";

import { Faq } from "@/components/marketing/faq";
import { Pricing } from "@/components/marketing/pricing";
import { getMessages } from "@/lib/i18n";
import { getPublicPlans } from "@/lib/plans";

const t = getMessages("bn");

export const metadata: Metadata = {
  title: t.marketing.nav.pricing,
};

export default async function PricingPage() {
  const plans = await getPublicPlans();

  return (
    <>
      <Pricing pricing={t.marketing.pricing} plans={plans} />
      <Faq faq={t.marketing.faq} />
    </>
  );
}
