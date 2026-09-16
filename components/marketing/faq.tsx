import { Reveal } from "@/components/marketing/reveal";
import { SectionHeading } from "@/components/marketing/section-heading";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import type { Messages } from "@/lib/i18n";
import { sectionIds } from "@/lib/marketing/site";

export function Faq({ faq }: { faq: Messages["marketing"]["faq"] }) {
  return (
    <section id={sectionIds.faq} className="mx-auto max-w-6xl scroll-mt-20 px-4 py-16 sm:px-6 lg:py-24">
      <SectionHeading eyebrow={faq.eyebrow} title={faq.title} description={faq.description} />

      <Reveal delay={0.1} className="mx-auto mt-12 max-w-[700px]">
        <Accordion type="single" collapsible className="rounded-xl bg-surface px-6 shadow-xs sm:px-8">
          {faq.items.map((item, i) => (
            <AccordionItem key={item.question} value={`item-${i}`}>
              <AccordionTrigger>{item.question}</AccordionTrigger>
              <AccordionContent className="text-base">{item.answer}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </Reveal>
    </section>
  );
}
