import { Faq } from "@/components/marketing/faq";
import { Features } from "@/components/marketing/features";
import { Hero } from "@/components/marketing/hero";
import { Lifecycle } from "@/components/marketing/lifecycle";
import { Pricing } from "@/components/marketing/pricing";
import { getMessages } from "@/lib/i18n";
import { getPublicPlans } from "@/lib/plans";

export default async function LandingPage() {
  const t = getMessages("bn");
  const plans = await getPublicPlans();

  return (
    <>
      <Hero common={t.common} hero={t.marketing.hero} />
      <Lifecycle lifecycle={t.marketing.lifecycle} />
      <Features features={t.marketing.features} />
      <Pricing pricing={t.marketing.pricing} plans={plans} />
      <Faq faq={t.marketing.faq} />
    </>
  );
}
