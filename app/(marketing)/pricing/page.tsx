import type { Metadata } from "next";

import { Faq } from "@/components/marketing/faq";
import { Pricing } from "@/components/marketing/pricing";
import { getMessages } from "@/lib/i18n";

const t = getMessages("bn");

export const metadata: Metadata = {
  title: t.marketing.nav.pricing,
};

export default function PricingPage() {
  return (
    <>
      <Pricing pricing={t.marketing.pricing} />
      <Faq faq={t.marketing.faq} />
    </>
  );
}
