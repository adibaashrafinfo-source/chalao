// Marketing-site config that isn't copy. Copy lives in lib/i18n.

// TODO(Ashraf): real demo booking link (Calendly, WhatsApp, form…). Until then "Book a Demo" goes to signup.
export const demoHref = process.env.NEXT_PUBLIC_DEMO_URL || "/signup?intent=demo";

export const sectionIds = {
  features: "features",
  pricing: "pricing",
  faq: "faq",
} as const;

export type PlanId = "free" | "starter" | "growth" | "business";

// TODO(Ashraf): placeholder prices and limits — confirm against the blueprint §35 before launch.
export const plans: { id: PlanId; monthlyPrice: number; highlighted?: boolean }[] = [
  { id: "free", monthlyPrice: 0 },
  { id: "starter", monthlyPrice: 990 },
  { id: "growth", monthlyPrice: 2490, highlighted: true },
  { id: "business", monthlyPrice: 4990 },
];
