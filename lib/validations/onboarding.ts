import { z } from "zod";

// Must match the business_type enum in the database.
export const businessTypeValues = ["fashion", "cosmetics", "electronics", "home", "food", "other"] as const;
export type BusinessType = (typeof businessTypeValues)[number];

export const onboardingSchema = z.object({
  organizationName: z.string().trim().min(2, "Business name is required").max(120),
  businessType: z.enum(businessTypeValues),
});

export type OnboardingValues = z.infer<typeof onboardingSchema>;
